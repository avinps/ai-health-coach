import json
import os
import pickle
import warnings
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

import numpy as np
import pandas as pd

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel, Field, field_validator

warnings.filterwarnings("ignore")

# Project root detection (works from src/api/main.py AND api/main.py) 
def _find_root() -> Path:
    here = Path(__file__).resolve()
    for candidate in [here.parent, here.parents[1], here.parents[2], here.parents[3]]:
        if (candidate / "saved_models").exists() or (candidate / "models").exists():
            return candidate
    return here.parents[2]

ROOT = _find_root()
# Artifacts saved by the notebook as saved_models/
SAVED_DIR = ROOT / "saved_models"
SAVED_DIR.mkdir(parents=True, exist_ok=True)

# App 
# Disable interactive API docs in production.
# Set ENVIRONMENT=development in your .env to re-enable during local dev.
_env = os.getenv("ENVIRONMENT", "production")
_docs_url    = "/docs"    if _env == "development" else None
_redoc_url   = "/redoc"   if _env == "development" else None
_openapi_url = "/openapi.json" if _env == "development" else None

app = FastAPI(
    title="AI Health Coach API v3.0",
    description="7-target health risk prediction using GradientBoosting on synthetic_health_risk_75k",
    version="3.0.0",
    docs_url=_docs_url,
    redoc_url=_redoc_url,
    openapi_url=_openapi_url,
)
# Rate limiter — 30 requests per minute per IP on the predict endpoint
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — never use "*" in production.
# Set ALLOWED_ORIGINS in your .env file, e.g.:
#   ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:5173
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000"   # safe dev default
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,      # no cookies/auth in Phase 1 — keep False
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Accept"],
)

# Security headers middleware — adds hardening headers to every response
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"]        = "DENY"
    response.headers["Referrer-Policy"]        = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"]       = "1; mode=block"
    # Restrict what the API response can do in a browser context
    response.headers["Content-Security-Policy"] = "default-src 'none'"
    return response

# Request body size limit — reject payloads larger than 64 KB
MAX_BODY_BYTES = 64 * 1024   # 64 KB — a valid health form JSON is ~2 KB

@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    if request.method == "POST":
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_BODY_BYTES:
            return JSONResponse(
                status_code=413,
                content={"detail": "Request body too large. Maximum allowed is 64 KB."}
            )
    return await call_next(request)

# Artifact registry 
A: Dict[str, Any] = {}   # loaded at startup


def _load_pkl(name: str) -> Any:
    p = SAVED_DIR / name
    if not p.exists():
        print(f"  ⚠️  {p} not found")
        return None
    with open(p, "rb") as f:
        obj = pickle.load(f)
    print(f"  ✅ {name}")
    return obj


@app.on_event("startup")
async def startup():
    print("\n🚀 AI Health Coach API v3.0 — starting up")
    # Filesystem paths are intentionally not logged to avoid exposing
    # internal directory structure in cloud log aggregators.
    A["models"]   = _load_pkl("all_models.pkl")
    A["pipeline"] = _load_pkl("preprocessing_pipeline.pkl")

    if A["pipeline"]:
        pp = A["pipeline"]
        print(f"   Features loaded: {len(pp['feature_columns'])}")
        print(f"   Target models:   {len(pp['target_configs'])}")
    print("✅ Startup complete.\n")


# Feature importance helpers 

# Features the user CANNOT change. Used to colour code the xAI bars
NON_MODIFIABLE_FEATURES = {
    'age', 'age_decade', 'bmi_age_interaction', 'is_female_reproductive',
    'family_history_diabetes', 'family_history_heart_disease',
    'family_history_hypertension', 'family_history_obesity', 'family_history_pcos',
    'family_history_load',
    'has_asthma', 'has_thyroid', 'has_allergies',
    'gender_Male', 'gender_Other',
    # height_cm and weight_kg are always hidden. BMI already represents them.
    # Showing raw height/weight alongside BMI is redundant and confusing.
    'height_cm', 'weight_kg',
}


def _is_non_modifiable(feature: str) -> bool:
    return feature in NON_MODIFIABLE_FEATURES


def _build_suppressed_features(raw_input: dict) -> set:
    """
    To Build the set of feature names to suppress from the xAI chart based on
    the user's actual raw input values.

    Philosophy: only show a feature if the user's value for it is
    SCIENTIFICALLY contributing to the risk — not just because the model
    considers it globally important.

    Rules applied:
      - Smoking        - suppress if Never
      - Alcohol        - suppress if Never
      - Processed food - suppress if Never or Rarely
      - Family history (any) - suppress each one individually if answered No
      - family_history_load (engineered) - suppress if ALL family histories are No
      - has_asthma / has_thyroid / has_allergies - suppress if No
      - Diabetes symptom cluster (frequent_urination, slow_wound_healing,
        numbness_tingling, diabetes_symptom_count) - suppress all if every
        individual symptom is No
      - BMI / bmi_risk_cat / bmi_age_interaction - suppress if BMI is in the
        healthy range (18.5–22.9, user-specified). Show for underweight and
        overweight/obese because both genuinely affect health risk.
      - height_cm / weight_kg - ALWAYS suppressed (BMI represents them).
      - exercise_level / sedentary_screen_index - suppress only when Moderate
        or Active. Always show when Sedentary or Light.
      - eat_veggies_daily / eat_fruits_daily - suppress if value is Yes
        (eating them is PROTECTIVE; showing them as a risk bar is misleading)
      - healthy_diet_score - suppress if score >= 2 (reasonably healthy diet)
      - sleep_deviation - suppress if deviation from 7.5h is <= 1.5h (acceptable range)
    """
    suppressed = set()
    r = raw_input  # shorthand

    # 1. Smoking 
    if r.get('smoking_status') == 'Never':
        suppressed.add('smoking_status')

    # 2. Alcohol 
    if r.get('alcohol_consumption') == 'Never':
        suppressed.add('alcohol_consumption')

    # 3. Processed food 
    # Never=0, Rarely=1 are acceptable; only Moderate=2 / Heavy=3 are risk-adding
    if r.get('eat_processed_food') in ('Never', 'Rarely'):
        suppressed.add('eat_processed_food')

    # 4. Family history — each field individually 
    fh_fields = [
        'family_history_diabetes', 'family_history_heart_disease',
        'family_history_hypertension', 'family_history_obesity',
        'family_history_pcos',
    ]
    fh_yes_count = 0
    for fh in fh_fields:
        val = r.get(fh)
        if val == 'No' or val == 'N/A' or val is None:
            suppressed.add(fh)
        elif val == 'Yes':
            fh_yes_count += 1

    # family_history_load is the engineered sum of all family histories.
    # Suppress it unless at least one family history is Yes.
    if fh_yes_count == 0:
        suppressed.add('family_history_load')

    # 5. Diagnosed conditions 
    for cond in ('has_asthma', 'has_thyroid', 'has_allergies'):
        if r.get(cond) != 'Yes':
            suppressed.add(cond)

    # 6. Diabetes symptom cluster 
    # Only show these if the user actually reported the symptom.
    # diabetes_symptom_count is an engineered sum. suppress it if all are No.
    symptom_fields = ('frequent_urination', 'slow_wound_healing', 'numbness_tingling')
    any_symptom = any(r.get(f) == 'Yes' for f in symptom_fields)
    for f in symptom_fields:
        if r.get(f) != 'Yes':
            suppressed.add(f)
    if not any_symptom:
        suppressed.add('diabetes_symptom_count')

    # 7. BMI and BMI-derived features 
    # Healthy range: 18.5–22.9 (user-specified).
    # Suppress bmi/bmi_risk_cat/bmi_age_interaction only inside this range.
    # Show for underweight (< 18.5) AND overweight/obese (>= 23) because
    # both directions are genuine risk contributors.
    # height_cm and weight_kg are ALWAYS suppressed (BMI already represents them).
    suppressed.update({'height_cm', 'weight_kg'})
    bmi_val = r.get('bmi')
    try:
        bmi_float = float(bmi_val)
        if 18.5 <= bmi_float <= 22.9:
            suppressed.update({'bmi', 'bmi_risk_cat', 'bmi_age_interaction'})
    except (TypeError, ValueError):
        pass

    # 8. Fruit and vegetable intake 
    # Eating fruits/veggies daily is PROTECTIVE — suppress from risk chart.
    if r.get('eat_fruits_daily') == 'Yes':
        suppressed.add('eat_fruits_daily')
    if r.get('eat_veggies_daily') == 'Yes':
        suppressed.add('eat_veggies_daily')

    # 9. Healthy diet score (engineered) 
    # Compute the same way as the notebook to know if diet is genuinely poor.
    # Score range: 0–4. Score >= 2 = reasonably healthy → suppress.
    try:
        diet = r.get('diet_type', '')
        score = (
            (1 if r.get('eat_fruits_daily')  == 'Yes' else 0) +
            (1 if r.get('eat_veggies_daily') == 'Yes' else 0) +
            (1 if r.get('eat_processed_food') in ('Never', 'Rarely') else 0) +
            (1 if diet in ('Mediterranean', 'Vegetarian', 'Vegan') else 0)
        )
        if score >= 2:
            suppressed.add('healthy_diet_score')
    except Exception:
        pass

    # 10. Sleep deviation 
    # Sleep between 6–9h (deviation from 7.5h <= 1.5h) is acceptable.
    try:
        sleep = float(r.get('avg_sleep_hours', 7.5))
        if abs(sleep - 7.5) <= 1.5:
            suppressed.add('sleep_deviation')
    except (TypeError, ValueError):
        pass

    # 11. Exercise level 
    # Suppress exercise_level and sedentary_screen_index only when exercise is
    # genuinely good (Moderate or Active). Sedentary and Light are real risk
    # contributors and must always be shown when selected.
    exercise = r.get('exercise_level', '')
    if exercise in ('Moderate', 'Active'):
        suppressed.add('exercise_level')
        suppressed.add('sedentary_screen_index')
    # Note: 'Sedentary' and 'Light' are deliberately NOT suppressed here.

    return suppressed


def _extract_shap_row(sv, row_idx: int = 0) -> np.ndarray:
    """
    Extract a 1-D SHAP array for a single prediction row from any SHAP output format.

    GradientBoostingClassifier can return:
      - list of arrays: one per class  → take class-1 (risk class)
      - 3-D array (n_samples, n_features, n_classes) → slice [:, :, 1]
      - 2-D array (n_samples, n_features)            → take row
    """
    if isinstance(sv, list):
        # list of (n_samples, n_features) arrays — index 1 = positive/risk class
        arr = np.array(sv[1] if len(sv) > 1 else sv[0])
    else:
        arr = np.array(sv)

    if arr.ndim == 3:
        arr = arr[:, :, 1]   # (n, f, c) → (n, f) for risk class

    return arr[row_idx] if arr.ndim == 2 else arr


# Features guaranteed to appear when user's value is risky.
# Rule keys: raw_field, risky_values, features, targets (None=all), min_pts
# Exercise Level: Risk Matrix Y for all 7 targets, weight 5-12 each.
# sedentary_screen_index = (3-exercise_ordinal)*screen_time/3 — composite signal.
GUARANTEED_SHOW: list = [
    {
        'raw_field':    'exercise_level',
        'risky_values': ('Sedentary', 'Light'),
        'features':     ('exercise_level', 'sedentary_screen_index'),
        'targets':      None,
        'min_pts':      1.0,
    },
]


def _get_per_model_shap(
    models: dict,
    pipeline: dict,
    X_scaled: "pd.DataFrame",
    raw_input: dict,
    n: int = 8,
) -> dict:
    """
    To Compute true per sample, per feature SHAP contributions for all 7 models.

    Uses TreeExplainer → shap_values() on the actual preprocessed input row.

    Three-layer filtering + guarantee:
      1. Threshold of 0.35 pts — captures real contributions at low risk
         scores (e.g. Sedentary exercise when heart score is 15) while
         filtering true noise. Guaranteed features bypass this.
      2. Safe-value suppression: if the user's raw input for a feature matches
         a scientifically safe/protective value (e.g. smoking=Never, family
         history=No, BMI in healthy range), that feature is always suppressed
         even if SHAP leaks a small positive value due to tree interactions.
      3. Guaranteed-show injection: certain lifestyle features are ALWAYS shown
         when the user's value is in a known risky range (e.g. exercise=Sedentary),
         with a minimum impact of 1.0 pt. This prevents genuinely bad habits from
         being silently dropped by a low SHAP threshold.
    """
    import shap as shap_lib

    feature_cols = pipeline["feature_columns"]
    suppressed   = _build_suppressed_features(raw_input)

    # Build guaranteed sets — all model and per model
    guaranteed_all: set = set()
    guaranteed_per: dict = {}
    for rule in GUARANTEED_SHOW:
        if raw_input.get(rule['raw_field']) not in rule['risky_values']:
            continue
        for f in rule['features']:
            if f in suppressed:
                continue
            if rule['targets'] is None:
                guaranteed_all.add(f)
            else:
                for t in rule['targets']:
                    guaranteed_per.setdefault(t, set()).add(f)

    result: dict = {}

    for target_col, _ in pipeline["target_configs"]:
        model = models.get(target_col)
        if model is None:
            continue

        # Threshold 0.35 pts: loose enough to capture real contributions
        # at low risk scores while filtering true noise.
        # Guaranteed features bypass this via the 1.0 pt floor.
        threshold   = 0.35

        # Merge global + per-model guaranteed sets
        guaranteed = guaranteed_all | guaranteed_per.get(target_col, set())

        def _min_pts(feat: str) -> float:
            for rule in GUARANTEED_SHOW:
                if feat in rule['features']:
                    return rule['min_pts']
            return 1.0

        factors     = []
        shap_map: dict = {}

        try:
            explainer   = shap_lib.TreeExplainer(model)
            shap_values = explainer.shap_values(X_scaled)
            shap_row    = _extract_shap_row(shap_values, row_idx=0)

            for feat, sv in zip(feature_cols, shap_row):
                pts = round(float(sv) * 100, 1)
                shap_map[feat] = pts

            for feat, pts in shap_map.items():
                if feat in suppressed:
                    continue
                if pts < threshold and feat not in guaranteed:
                    continue
                if feat in guaranteed and pts < _min_pts(feat):
                    pts = _min_pts(feat)
                factors.append({
                    'feature':       feat,
                    'impact_points': pts,
                    'is_modifiable': not _is_non_modifiable(feat),
                })

            # Inject guaranteed features that SHAP didn't cover at all
            for feat in guaranteed:
                if feat in suppressed:
                    continue
                if any(f['feature'] == feat for f in factors):
                    continue
                if feat in feature_cols:
                    factors.append({
                        'feature':       feat,
                        'impact_points': _min_pts(feat),
                        'is_modifiable': not _is_non_modifiable(feat),
                    })

        except Exception:
            # Fallback: feature_importances_ × risk class probability
            try:
                imps   = model.feature_importances_
                y_prob = model.predict_proba(X_scaled)[0]
                le     = pipeline["target_encoders"][target_col]
                risk_prob = max(
                    (float(y_prob[i]) for i, cls in enumerate(le.classes_)
                     if cls not in ('Low', 'Poor', 'Excellent')),
                    default=float(y_prob.max())
                )
                for feat, imp in zip(feature_cols, imps):
                    if feat in suppressed:
                        continue
                    pts = round(float(imp) * risk_prob * 100, 1)
                    if pts < threshold and feat not in guaranteed:
                        continue
                    if feat in guaranteed and pts < _min_pts(feat):
                        pts = _min_pts(feat)
                    factors.append({
                        'feature':       feat,
                        'impact_points': pts,
                        'is_modifiable': not _is_non_modifiable(feat),
                    })
                # Inject guaranteed features missing from fallback
                for feat in guaranteed:
                    if feat in suppressed:
                        continue
                    if any(f['feature'] == feat for f in factors):
                        continue
                    if feat in feature_cols:
                        factors.append({
                            'feature':       feat,
                            'impact_points': _min_pts(feat),
                            'is_modifiable': not _is_non_modifiable(feat),
                        })
            except Exception:
                pass

        factors.sort(key=lambda x: x["impact_points"], reverse=True)
        result[target_col] = factors[:n]

    return result


# Input schema 

class HealthInput(BaseModel):
    """
    All 42 raw features collected by the frontend wizard.
    Categorical fields are sent as their string labels; encoding happens in the API.
    """
    # Numerical 
    age:                  float = Field(..., ge=18,  le=80)
    height_cm:            float = Field(..., ge=140, le=200)
    weight_kg:            float = Field(..., ge=35,  le=180)
    bmi:                  float = Field(..., ge=14,  le=55)
    avg_sleep_hours:      float = Field(..., ge=3,   le=12)
    stress_level:         int   = Field(..., ge=1,   le=10)
    work_stress:          int   = Field(..., ge=1,   le=10)
    screen_time_hours:    float = Field(..., ge=0.5, le=18)
    water_intake_liters:  float = Field(..., ge=0.5, le=5)
    meal_frequency:       int   = Field(..., ge=1,   le=6)
    anxiety_level:        int   = Field(..., ge=1,   le=10)
    fatigue_level:        int   = Field(..., ge=1,   le=10)

    # Categorical — each field is restricted to its exact allowed values.
    # Any value outside these sets is rejected with a 422 before it reaches
    # the preprocessing pipeline, preventing silent garbage-in outputs.
    gender:                       Literal["Male", "Female", "Other"]
    exercise_level:               Literal["Sedentary", "Light", "Moderate", "Active"]
    diet_type:                    Literal["Omnivore", "Non Vegetarian", "Vegetarian", "Vegan",
                                          "Pescatarian", "Keto/Low-carb", "Mediterranean",
                                          "Junk-food-heavy"]
    eat_fruits_daily:             Literal["Yes", "No"]
    eat_veggies_daily:            Literal["Yes", "No"]
    eat_processed_food:           Literal["Never", "Rarely", "Moderate", "Heavy"]
    metabolism_type:              Literal["Slow", "Normal", "Fast"]
    employment_status:            Literal["Student", "Employed", "Unemployed",
                                          "Self-Employed", "Retired"]
    work_type:                    Literal["Desk/Office", "Manual Labor", "Healthcare",
                                          "Creative", "Retail/Service", "Remote/WFH",
                                          "Field Work", "Student", "Homemaker",
                                          "Retired", "Unemployed/None"]
    alcohol_consumption:          Literal["Never", "Rarely", "Moderate", "Heavy", "Former"]
    smoking_status:               Literal["Never", "Former", "Current"]
    sun_exposure:                 Literal["Low", "Moderate", "High"]
    social_interaction_level:     Literal["Low", "Moderate", "High"]
    shortness_of_breath:          Literal["Never", "Rarely", "Sometimes", "Often"]
    frequent_headaches:           Literal["Never", "Rarely", "Sometimes", "Often"]
    digestive_issues:             Literal["Never", "Rarely", "Sometimes", "Often"]
    difficulty_falling_asleep:    Literal["Never", "Rarely", "Sometimes", "Often"]
    perceived_appetite:           Literal["Low", "Normal", "Excessive"]
    family_history_diabetes:      Literal["Yes", "No"]
    family_history_heart_disease: Literal["Yes", "No"]
    family_history_hypertension:  Literal["Yes", "No"]
    family_history_obesity:       Literal["Yes", "No"]
    family_history_pcos:          Literal["Yes", "No", "N/A"]
    has_asthma:                   Literal["Yes", "No"]
    has_thyroid:                  Literal["Yes", "No"]
    has_allergies:                Literal["Yes", "No"]
    frequent_urination:           Literal["Yes", "No"]
    slow_wound_healing:           Literal["Yes", "No"]
    numbness_tingling:            Literal["Yes", "No"]
    menstrual_regularity:         Literal["Regular", "Irregular", "Very Irregular", "N/A"]


# Preprocessing: exact mirror of the notebook 

# These mappings are identical to Cell 11 in preprocessing_ml_pipeline.ipynb
ORDINAL_MAPPINGS = {
    'exercise_level':           {'Sedentary': 0, 'Light': 1, 'Moderate': 2, 'Active': 3},
    'eat_processed_food':       {'Never': 0, 'Rarely': 1, 'Moderate': 2, 'Heavy': 3},
    'shortness_of_breath':      {'Never': 0, 'Rarely': 1, 'Sometimes': 2, 'Often': 3},
    'difficulty_falling_asleep':{'Never': 0, 'Rarely': 1, 'Sometimes': 2, 'Often': 3},
    'frequent_headaches':       {'Never': 0, 'Rarely': 1, 'Sometimes': 2, 'Often': 3},
    'digestive_issues':         {'Never': 0, 'Rarely': 1, 'Sometimes': 2, 'Often': 3},
    'social_interaction_level': {'Low': 0, 'Moderate': 1, 'High': 2},
    'metabolism_type':          {'Slow': 0, 'Normal': 1, 'Fast': 2},
    'perceived_appetite':       {'Low': 0, 'Normal': 1, 'Excessive': 2},
    'sun_exposure':             {'Low': 0, 'Moderate': 1, 'High': 2},
    'alcohol_consumption':      {'Never': 0, 'Rarely': 1, 'Moderate': 2, 'Heavy': 3, 'Former': 4},
    'menstrual_regularity':     {'N/A': -1, 'Regular': 0, 'Irregular': 1, 'Very Irregular': 2},
}

# These mappings are identical to Cell 12
BINARY_MAPPINGS = {
    'eat_fruits_daily':             {'Yes': 1, 'No': 0},
    'eat_veggies_daily':            {'Yes': 1, 'No': 0},
    'family_history_diabetes':      {'Yes': 1, 'No': 0},
    'family_history_heart_disease': {'Yes': 1, 'No': 0},
    'family_history_hypertension':  {'Yes': 1, 'No': 0},
    'family_history_obesity':       {'Yes': 1, 'No': 0},
    'has_asthma':                   {'Yes': 1, 'No': 0},
    'has_thyroid':                  {'Yes': 1, 'No': 0},
    'has_allergies':                {'Yes': 1, 'No': 0},
    'frequent_urination':           {'Yes': 1, 'No': 0},
    'slow_wound_healing':           {'Yes': 1, 'No': 0},
    'numbness_tingling':            {'Yes': 1, 'No': 0},
    'family_history_pcos':          {'Yes': 1, 'No': 0, 'N/A': -1},
    'smoking_status':               {'Never': 0, 'Former': 1, 'Current': 2},
}

# Nominal columns one-hot encoded with drop_first=True (Cell 13)
NOMINAL_COLS = ['gender', 'diet_type', 'employment_status', 'work_type']

# Engineered features (Cell 9)
EXERCISE_MAP = {'Sedentary': 0, 'Light': 1, 'Moderate': 2, 'Active': 3}


def preprocess(inp: HealthInput, pipeline: Dict) -> pd.DataFrame:
    """
    Convert a HealthInput object into the exact feature DataFrame that
    the trained GradientBoosting models expect.

    Steps mirror preprocessing_ml_pipeline.ipynb cells 5–14 exactly.
    """
    # 1. Build raw row dict 
    raw = inp.dict()

    # Handle the 'Omnivore' -> 'Non Vegetarian' rename that was applied to training data
    # The notebook's Cell 5 renamed 'Omnivore' to 'Non Vegetarian'
    # The form sends 'Non Vegetarian' directly. so no rename needed here.

    df = pd.DataFrame([raw])

    # 2. Ordinal encoding 
    for col, mapping in ORDINAL_MAPPINGS.items():
        if col in df.columns:
            df[col] = df[col].map(mapping)
            # If value not in mapping (unknown), use 0 as safe default
            df[col] = df[col].fillna(0)

    # 3. Binary encoding 
    for col, mapping in BINARY_MAPPINGS.items():
        if col in df.columns:
            df[col] = df[col].map(mapping)
            df[col] = df[col].fillna(0)

    # 4. One-hot encoding (match training get_dummies with drop_first=True) 
    df = pd.get_dummies(df, columns=NOMINAL_COLS, drop_first=True, dtype=int)

    # 5. Engineered features (Cell 9) 
    # 5a. BMI risk category
    df['bmi_risk_cat'] = pd.cut(df['bmi'],
        bins=[0, 18.5, 25, 30, 35, 40, 100],
        labels=[0, 1, 2, 3, 4, 5]).astype(int)

    # 5b. Sleep deviation from optimal 7.5h
    df['sleep_deviation'] = abs(df['avg_sleep_hours'] - 7.5)

    # 5c. Diabetes symptom count (using already-encoded values)
    df['diabetes_symptom_count'] = (
        df.get('frequent_urination', pd.Series([0])).fillna(0).astype(int) +
        df.get('slow_wound_healing', pd.Series([0])).fillna(0).astype(int) +
        df.get('numbness_tingling',  pd.Series([0])).fillna(0).astype(int) +
        # perceived_appetite was encoded: Excessive=2
        (df.get('perceived_appetite', pd.Series([0])).fillna(0) == 2).astype(int)
    )

    # 5d. Family history load
    fh_cols = ['family_history_diabetes', 'family_history_heart_disease',
               'family_history_hypertension', 'family_history_obesity']
    df['family_history_load'] = sum(
        df.get(c, pd.Series([0])).fillna(0).clip(lower=0) for c in fh_cols
    )

    # 5e. Stress-anxiety composite
    df['stress_anxiety_composite'] = (
        df['stress_level'] + df['anxiety_level'] + df['work_stress']
    ) / 3.0

    # 5f. Healthy diet score (requires original string values — compute from numerics)
    # eat_fruits_daily=1 (Yes), eat_veggies_daily=1 (Yes)
    # eat_processed_food Never=0, Rarely=1 -> <=1 counts as healthy
    # diet_type: Mediterranean/Vegetarian/Vegan -> handled via one-hot cols
    med_col  = df.get('diet_type_Mediterranean', pd.Series([0])).fillna(0)
    veg_col  = df.get('diet_type_Vegetarian',    pd.Series([0])).fillna(0)
    vegan_col= df.get('diet_type_Vegan',         pd.Series([0])).fillna(0)
    df['healthy_diet_score'] = (
        df.get('eat_fruits_daily',  pd.Series([0])).fillna(0).astype(int) +
        df.get('eat_veggies_daily', pd.Series([0])).fillna(0).astype(int) +
        (df.get('eat_processed_food', pd.Series([0])).fillna(0) <= 1).astype(int) +
        (med_col + veg_col + vegan_col).clip(upper=1).astype(int)
    )

    # 5g. Age decade
    df['age_decade'] = (df['age'] // 10) * 10

    # 5h. BMI × age interaction
    df['bmi_age_interaction'] = df['bmi'] * np.log1p(df['age'])

    # 5i. Sedentary screen index (exercise_level already encoded as 0-3)
    ex_num = df.get('exercise_level', pd.Series([1])).fillna(1)
    df['sedentary_screen_index'] = (3 - ex_num) * df['screen_time_hours'] / 3

    # 5j. Is female reproductive age
    # gender was one-hot: after drop_first on ['Male','Female','Other']
    # The base (dropped) category depends on alphabetical order: Female, Male, Other
    # drop_first=True drops 'Female' → columns are gender_Male, gender_Other
    # So is_female_reproductive: NOT (gender_Male or gender_Other) AND age <= 50
    is_male  = df.get('gender_Male',  pd.Series([0])).fillna(0)
    is_other = df.get('gender_Other', pd.Series([0])).fillna(0)
    is_female = ((is_male == 0) & (is_other == 0)).astype(int)
    df['is_female_reproductive'] = (is_female & (df['age'] <= 50)).astype(int)

    # 6. Align columns to training feature set 
    trained_cols = pipeline['feature_columns']

    # Add any columns that appeared in training but aren't in this row
    # (can happen for one-hot categories not present in single-row inference)
    for col in trained_cols:
        if col not in df.columns:
            df[col] = 0

    # Reorder to exact training column order, drop any extras
    df = df[trained_cols]

    # 7. Scale 
    scaler = pipeline['scaler']
    X_scaled = scaler.transform(df)
    return pd.DataFrame(X_scaled, columns=trained_cols)


# SHAP helper 

def _extract_shap_class1(sv) -> np.ndarray:
    """Handle both old (list) and new (3D ndarray) SHAP output formats."""
    sv_arr = np.array(sv) if not isinstance(sv, np.ndarray) else sv
    if isinstance(sv, list):
        sv_arr = np.array(sv[1] if len(sv) > 1 else sv[0])
    elif sv_arr.ndim == 3:
        sv_arr = sv_arr[:, :, 1]   # (n, f, c) → (n, f) class-1 slice
    return sv_arr


def get_shap_explanation(model, X_df: pd.DataFrame, feature_cols: List[str], n: int = 8) -> Dict:
    try:
        import shap
        explainer   = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_df)
        sv = _extract_shap_class1(shap_values)
        # sv is (1, n_features) for a single sample — take row 0
        arr = sv[0] if sv.ndim == 2 else sv
        drivers = sorted(
            [{"feature": f, "impact": round(abs(float(v)), 5)} for f, v in zip(feature_cols, arr)],
            key=lambda x: x["impact"], reverse=True,
        )
        return {"method": "shap", "top_risk_drivers": drivers[:n]}
    except ImportError:
        pass
    except Exception as e:
        pass
    # Fallback: GBM feature importances
    try:
        imps = model.feature_importances_
        drivers = sorted(
            [{"feature": f, "impact": round(float(v), 5)} for f, v in zip(feature_cols, imps)],
            key=lambda x: x["impact"], reverse=True,
        )
        return {"method": "rf_importance_fallback", "top_risk_drivers": drivers[:n]}
    except Exception as e2:
        return {"method": "unavailable", "error": str(e2), "top_risk_drivers": []}


# Endpoints 

@app.get("/health")
async def health():
    models_loaded   = A.get("models") is not None
    pipeline_loaded = A.get("pipeline") is not None
    # Do NOT expose filesystem paths, directory structure, or internal layout.
    return {
        "status":  "healthy" if models_loaded and pipeline_loaded else "degraded",
        "version": "3.0.0",
    }


@app.post("/predict/risks")
@limiter.limit("30/minute")
async def predict_risks(request: Request, inp: HealthInput):
    """
    Run all 7 GradientBoosting models and return level + score for each target.
    Also returns SHAP explanation (or feature importances as fallback).
    """
    for key, name in [("models", "all_models.pkl"), ("pipeline", "preprocessing_pipeline.pkl")]:
        if A.get(key) is None:
            raise HTTPException(
                503,
                f"Service temporarily unavailable: model '{name}' not loaded. "
                "Please try again later or contact support."
            )

    pipeline = A["pipeline"]
    models   = A["models"]

    # Preprocess 
    try:
        X_scaled = preprocess(inp, pipeline)
    except Exception as e:
        raise HTTPException(422, "Invalid input data. Please check all fields and try again.")

    # Predict all 7 targets 
    predictions = {}
    target_configs = pipeline["target_configs"]
    target_encoders = pipeline["target_encoders"]

    for target_col, _ in target_configs:
        model = models.get(target_col)
        if model is None:
            continue

        le     = target_encoders[target_col]
        y_pred = model.predict(X_scaled)[0]           # integer class index
        y_prob = model.predict_proba(X_scaled)[0]     # probabilities per class

        # Decode label
        level  = le.inverse_transform([y_pred])[0]

        # Weighted risk score 0–100:
        # For each class, multiply its probability by a severity weight.
        # Low/Poor=0.15, Medium/Fair=0.50, Good=0.75, High/Excellent=1.0
        level_weights = {}
        for cls in le.classes_:
            if cls in ('Low', 'Poor'):
                level_weights[cls] = 0.15
            elif cls in ('Medium', 'Fair'):
                level_weights[cls] = 0.50
            elif cls == 'Good':
                level_weights[cls] = 0.75
            elif cls in ('High', 'Excellent'):
                level_weights[cls] = 1.0
            else:
                level_weights[cls] = 0.5

        score = sum(
            float(y_prob[i]) * level_weights.get(cls, 0.5) * 100
            for i, cls in enumerate(le.classes_)
        )
        score = round(float(np.clip(score, 0, 100)), 1)

        score_key = target_col.replace('_level', '_score')
        predictions[target_col]  = level
        predictions[score_key]   = score

    # SHAP on the primary model (diabetes) 
    primary_model = models.get("diabetes_risk_level")
    explanation = {"method": "unavailable", "top_risk_drivers": []}
    if primary_model is not None:
        explanation = get_shap_explanation(
            primary_model, X_scaled, pipeline["feature_columns"]
        )

    feature_importances = _get_per_model_shap(models, pipeline, X_scaled, inp.dict())

    return {
        "status":              "success",
        "predictions":         predictions,
        "explanation":         explanation,
        "feature_importances": feature_importances,
    }
