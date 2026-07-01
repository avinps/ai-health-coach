import asyncio
import json
import os
import pickle
import uuid
import warnings
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

import numpy as np
import pandas as pd

# recommendation engine (curated substrate + gemini + fallback).
# try/except so it works whether run as `src.api.main:app` or directly.
try:
    from . import recommendations as recs
except ImportError:  # pragma: no cover
    import recommendations as recs

# database for analytics. does nothing if DATABASE_URL is not set.
try:
    from . import db as db
except ImportError:  # pragma: no cover
    import db as db

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel, Field, field_validator

warnings.filterwarnings("ignore")

# find the project root (works from src/api/main.py and api/main.py)
def _find_root() -> Path:
    here = Path(__file__).resolve()
    for candidate in [here.parent, here.parents[1], here.parents[2], here.parents[3]]:
        if (candidate / "saved_models").exists() or (candidate / "models").exists():
            return candidate
    return here.parents[2]

ROOT = _find_root()
# the notebook saves the models into saved_models/
SAVED_DIR = ROOT / "saved_models"
SAVED_DIR.mkdir(parents=True, exist_ok=True)

# app setup.
# turn off the interactive api docs in production.
# set ENVIRONMENT=development in your .env to get them back during local dev.
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
# rate limiter, 30 requests per minute per ip on the predict endpoint
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# cors. don't use "*" in production.
# set ALLOWED_ORIGINS in your .env, for example:
#   ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:5173
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000"   # safe dev default
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,      # no cookies/auth in phase 1, keep this False
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Accept"],
)

# adds some security headers to every response
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"]        = "DENY"
    response.headers["Referrer-Policy"]        = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"]       = "1; mode=block"
    # limit what the api response can do inside a browser
    response.headers["Content-Security-Policy"] = "default-src 'none'"
    return response

# reject request bodies bigger than 64 kb
MAX_BODY_BYTES = 64 * 1024   # a valid health form json is around 2 kb

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

# loaded artifacts live here
A: Dict[str, Any] = {}   # filled at startup


def _load_pkl(name: str) -> Any:
    p = SAVED_DIR / name
    if not p.exists():
        print(f"  {p} not found")
        return None
    with open(p, "rb") as f:
        obj = pickle.load(f)
    print(f"  loaded {name}")
    return obj


@app.on_event("startup")
async def startup():
    print("\nAI Health Coach API v3.0 starting up")
    # not logging file paths on purpose, so the internal folder layout doesn't
    # end up in cloud logs.
    A["models"]   = _load_pkl("all_models.pkl")
    A["pipeline"] = _load_pkl("preprocessing_pipeline.pkl")

    if A["pipeline"]:
        pp = A["pipeline"]
        print(f"   features loaded: {len(pp['feature_columns'])}")
        print(f"   target models:   {len(pp['target_configs'])}")

    # gemini client for the recommendations endpoint.
    # optional: if there's no api key (or the package isn't installed) the
    # recommendations just fall back to the deterministic substrate. the app still
    # boots and /predict/risks is not affected.
    A["genai_client"] = None
    A["gemini_model"] = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    _gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if _gemini_key:
        try:
            from google import genai
            A["genai_client"] = genai.Client(api_key=_gemini_key)
            print(f"   gemini client ready (model: {A['gemini_model']})")
        except Exception:
            print("   gemini not available, recommendations will use the fallback")
    else:
        print("   no GEMINI_API_KEY set, recommendations will use the fallback")

    # optional database for analytics
    db.init_db()

    print("startup complete\n")


def _gemini_call(system_instruction: str, prompt: str) -> str:
    """blocking gemini call. run it with asyncio.to_thread from the async endpoint.

    uses the sdk's native json output mode (response_mime_type), which is a lot
    more reliable than just asking the model to "return json" in the prompt.

    thinking_budget=0 turns off the model's internal thinking step. gemini-2.5-flash
    is a thinking model by default, and that reasoning uses up output tokens, which
    can starve and cut off the actual json. this task is selection + phrasing, not
    reasoning, so turning thinking off makes the json reliable and the call faster.
    """
    from google.genai import types
    client = A["genai_client"]
    resp = client.models.generate_content(
        model=A["gemini_model"],
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
            temperature=0.6,
            max_output_tokens=8192,
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        ),
    )
    return resp.text


# helpers for feature importance

# features the user can't change. used to colour the xai bars
NON_MODIFIABLE_FEATURES = {
    'age', 'age_decade', 'bmi_age_interaction', 'is_female_reproductive',
    'family_history_diabetes', 'family_history_heart_disease',
    'family_history_hypertension', 'family_history_obesity', 'family_history_pcos',
    'family_history_load',
    'has_asthma', 'has_thyroid', 'has_allergies',
    'gender_Male', 'gender_Other',
    # height_cm and weight_kg are always hidden. bmi already covers them.
    # showing raw height/weight next to bmi is redundant and confusing.
    'height_cm', 'weight_kg',
}


def _is_non_modifiable(feature: str) -> bool:
    return feature in NON_MODIFIABLE_FEATURES


def _build_suppressed_features(raw_input: dict) -> set:
    """build the set of feature names to hide from the xai chart, based on the
    user's actual raw answers.

    idea: only show a feature if the user's value for it is actually adding to the
    risk, not just because the model thinks it's globally important.

    the rules:
      - smoking        - hide if Never
      - alcohol        - hide if Never
      - processed food - hide if Never or Rarely
      - family history (each one) - hide if answered No
      - family_history_load (engineered) - hide if all family histories are No
      - has_asthma / has_thyroid / has_allergies - hide if No
      - diabetes symptoms (frequent_urination, slow_wound_healing,
        numbness_tingling, diabetes_symptom_count) - hide all if every symptom is No
      - bmi / bmi_risk_cat / bmi_age_interaction - hide if bmi is in the healthy
        range (18.5-22.9). show for underweight and overweight/obese because both
        actually affect risk.
      - height_cm / weight_kg - always hidden (bmi covers them).
      - exercise_level / sedentary_screen_index - hide only when Moderate or
        Active. always show when Sedentary or Light.
      - eat_veggies_daily / eat_fruits_daily - hide if Yes (eating them is
        protective, showing them as a risk bar is misleading)
      - healthy_diet_score - hide if score >= 2 (reasonably healthy diet)
      - sleep_deviation - hide if it's within 1.5h of 7.5h (fine range)
    """
    suppressed = set()
    r = raw_input  # shorthand

    # smoking
    if r.get('smoking_status') == 'Never':
        suppressed.add('smoking_status')

    # alcohol
    if r.get('alcohol_consumption') == 'Never':
        suppressed.add('alcohol_consumption')

    # processed food
    # Never=0, Rarely=1 are fine, only Moderate=2 / Heavy=3 add risk
    if r.get('eat_processed_food') in ('Never', 'Rarely'):
        suppressed.add('eat_processed_food')

    # family history, each field on its own
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
    # hide it unless at least one family history is Yes.
    if fh_yes_count == 0:
        suppressed.add('family_history_load')

    # diagnosed conditions
    for cond in ('has_asthma', 'has_thyroid', 'has_allergies'):
        if r.get(cond) != 'Yes':
            suppressed.add(cond)

    # diabetes symptoms
    # only show these if the user actually reported the symptom.
    # diabetes_symptom_count is the engineered sum, hide it if all are No.
    symptom_fields = ('frequent_urination', 'slow_wound_healing', 'numbness_tingling')
    any_symptom = any(r.get(f) == 'Yes' for f in symptom_fields)
    for f in symptom_fields:
        if r.get(f) != 'Yes':
            suppressed.add(f)
    if not any_symptom:
        suppressed.add('diabetes_symptom_count')

    # bmi and the bmi-derived features
    # healthy range: 18.5-22.9.
    # hide bmi/bmi_risk_cat/bmi_age_interaction only inside this range.
    # show for underweight (< 18.5) and overweight/obese (>= 23) because both
    # directions really do add risk.
    # height_cm and weight_kg are always hidden (bmi already covers them).
    suppressed.update({'height_cm', 'weight_kg'})
    bmi_val = r.get('bmi')
    try:
        bmi_float = float(bmi_val)
        if 18.5 <= bmi_float <= 22.9:
            suppressed.update({'bmi', 'bmi_risk_cat', 'bmi_age_interaction'})
    except (TypeError, ValueError):
        pass

    # fruit and vegetable intake
    # eating fruits/veggies daily is protective, so hide it from the risk chart
    if r.get('eat_fruits_daily') == 'Yes':
        suppressed.add('eat_fruits_daily')
    if r.get('eat_veggies_daily') == 'Yes':
        suppressed.add('eat_veggies_daily')

    # healthy diet score (engineered)
    # compute it the same way the notebook does to know if the diet is actually poor.
    # score is 0-4. score >= 2 = reasonably healthy, so hide it.
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

    # sleep deviation
    # sleep between 6-9h (within 1.5h of 7.5h) is fine
    try:
        sleep = float(r.get('avg_sleep_hours', 7.5))
        if abs(sleep - 7.5) <= 1.5:
            suppressed.add('sleep_deviation')
    except (TypeError, ValueError):
        pass

    # exercise level
    # hide exercise_level and sedentary_screen_index only when exercise is actually
    # good (Moderate or Active). Sedentary and Light are real risk contributors and
    # should always be shown when selected.
    exercise = r.get('exercise_level', '')
    if exercise in ('Moderate', 'Active'):
        suppressed.add('exercise_level')
        suppressed.add('sedentary_screen_index')
    # note: 'Sedentary' and 'Light' are on purpose NOT hidden here.

    return suppressed


def _extract_shap_row(sv, row_idx: int = 0) -> np.ndarray:
    """pull a 1-d shap array for a single prediction row out of whatever shape
    shap gives back.

    GradientBoostingClassifier can return:
      - a list of arrays, one per class  -> take class 1 (the risk class)
      - a 3-d array (n_samples, n_features, n_classes) -> slice [:, :, 1]
      - a 2-d array (n_samples, n_features)            -> take the row
    """
    if isinstance(sv, list):
        # list of (n_samples, n_features) arrays, index 1 = positive/risk class
        arr = np.array(sv[1] if len(sv) > 1 else sv[0])
    else:
        arr = np.array(sv)

    if arr.ndim == 3:
        arr = arr[:, :, 1]   # (n, f, c) -> (n, f) for the risk class

    return arr[row_idx] if arr.ndim == 2 else arr


# features that always show up when the user's value is risky.
# rule keys: raw_field, risky_values, features, targets (None=all), min_pts
# exercise level matters for all 7 targets.
# sedentary_screen_index = (3-exercise_ordinal)*screen_time/3, a combined signal.
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
    """compute the real per-sample, per-feature shap contributions for all 7 models.

    uses TreeExplainer -> shap_values() on the actual preprocessed input row.

    three filters + a guarantee:
      1. threshold of 0.35 pts, catches real contributions at low risk scores
         (like Sedentary exercise when the heart score is 15) while filtering out
         noise. guaranteed features skip this.
      2. safe-value suppression: if the user's raw answer for a feature is a
         safe/protective value (smoking=Never, family history=No, bmi in healthy
         range), that feature is always hidden even if shap leaks a small value.
      3. guaranteed-show: some lifestyle features are always shown when the user's
         value is in a known risky range (like exercise=Sedentary), with a minimum
         impact of 1.0 pt. keeps genuinely bad habits from being dropped by a low
         shap threshold.
    """
    import shap as shap_lib

    feature_cols = pipeline["feature_columns"]
    suppressed   = _build_suppressed_features(raw_input)

    # build the guaranteed sets, both all-model and per-model
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

        # threshold 0.35 pts: loose enough to catch real contributions at low risk
        # scores while filtering noise. guaranteed features skip this via the 1.0 pt floor.
        threshold   = 0.35

        # merge the global + per-model guaranteed sets
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

            # add guaranteed features that shap didn't cover at all
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
            # fallback: feature_importances_ x risk class probability
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
                # add guaranteed features missing from the fallback
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


# input schema

class HealthInput(BaseModel):
    """all 42 raw features the frontend wizard collects.
    categorical fields come in as their string labels, encoding happens in the api."""
    # numbers
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

    # categorical, each field is locked to its exact allowed values.
    # anything outside these sets gets rejected with a 422 before it reaches the
    # preprocessing, which stops silent garbage-in outputs.
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


# preprocessing, has to match the notebook exactly

# same as cell 11 in the preprocessing notebook
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

# same as cell 12
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

# nominal columns, one-hot encoded with drop_first=True (cell 13)
NOMINAL_COLS = ['gender', 'diet_type', 'employment_status', 'work_type']

# engineered features (cell 9)
EXERCISE_MAP = {'Sedentary': 0, 'Light': 1, 'Moderate': 2, 'Active': 3}


def preprocess(inp: HealthInput, pipeline: Dict) -> pd.DataFrame:
    """turn a HealthInput into the exact feature dataframe the trained models want.

    steps match preprocessing_ml_pipeline.ipynb cells 5-14 exactly.
    """
    # 1. build the raw row dict
    raw = inp.dict()

    # the notebook's cell 5 renamed 'Omnivore' to 'Non Vegetarian' in the training data.
    # the form already sends 'Non Vegetarian', so no rename is needed here.

    df = pd.DataFrame([raw])

    # 2. ordinal encoding
    for col, mapping in ORDINAL_MAPPINGS.items():
        if col in df.columns:
            df[col] = df[col].map(mapping)
            # if a value isn't in the mapping, use 0 as a safe default
            df[col] = df[col].fillna(0)

    # 3. binary encoding
    for col, mapping in BINARY_MAPPINGS.items():
        if col in df.columns:
            df[col] = df[col].map(mapping)
            df[col] = df[col].fillna(0)

    # 4. one-hot encoding (matches training get_dummies with drop_first=True)
    df = pd.get_dummies(df, columns=NOMINAL_COLS, drop_first=True, dtype=int)

    # 5. engineered features (cell 9)
    # 5a. bmi risk category
    df['bmi_risk_cat'] = pd.cut(df['bmi'],
        bins=[0, 18.5, 25, 30, 35, 40, 100],
        labels=[0, 1, 2, 3, 4, 5]).astype(int)

    # 5b. sleep deviation from the ideal 7.5h
    df['sleep_deviation'] = abs(df['avg_sleep_hours'] - 7.5)

    # 5c. diabetes symptom count (using the already-encoded values)
    df['diabetes_symptom_count'] = (
        df.get('frequent_urination', pd.Series([0])).fillna(0).astype(int) +
        df.get('slow_wound_healing', pd.Series([0])).fillna(0).astype(int) +
        df.get('numbness_tingling',  pd.Series([0])).fillna(0).astype(int) +
        # perceived_appetite was encoded, Excessive=2
        (df.get('perceived_appetite', pd.Series([0])).fillna(0) == 2).astype(int)
    )

    # 5d. family history load
    fh_cols = ['family_history_diabetes', 'family_history_heart_disease',
               'family_history_hypertension', 'family_history_obesity']
    df['family_history_load'] = sum(
        df.get(c, pd.Series([0])).fillna(0).clip(lower=0) for c in fh_cols
    )

    # 5e. stress-anxiety composite
    df['stress_anxiety_composite'] = (
        df['stress_level'] + df['anxiety_level'] + df['work_stress']
    ) / 3.0

    # 5f. healthy diet score (needs the original strings, compute from numerics)
    # eat_fruits_daily=1 (Yes), eat_veggies_daily=1 (Yes)
    # eat_processed_food Never=0, Rarely=1 -> <=1 counts as healthy
    # diet_type: Mediterranean/Vegetarian/Vegan -> handled by the one-hot cols
    med_col  = df.get('diet_type_Mediterranean', pd.Series([0])).fillna(0)
    veg_col  = df.get('diet_type_Vegetarian',    pd.Series([0])).fillna(0)
    vegan_col= df.get('diet_type_Vegan',         pd.Series([0])).fillna(0)
    df['healthy_diet_score'] = (
        df.get('eat_fruits_daily',  pd.Series([0])).fillna(0).astype(int) +
        df.get('eat_veggies_daily', pd.Series([0])).fillna(0).astype(int) +
        (df.get('eat_processed_food', pd.Series([0])).fillna(0) <= 1).astype(int) +
        (med_col + veg_col + vegan_col).clip(upper=1).astype(int)
    )

    # 5g. age decade
    df['age_decade'] = (df['age'] // 10) * 10

    # 5h. bmi x age interaction
    df['bmi_age_interaction'] = df['bmi'] * np.log1p(df['age'])

    # 5i. sedentary screen index (exercise_level already encoded as 0-3)
    ex_num = df.get('exercise_level', pd.Series([1])).fillna(1)
    df['sedentary_screen_index'] = (3 - ex_num) * df['screen_time_hours'] / 3

    # 5j. is female of reproductive age
    # gender was one-hot: after drop_first on ['Male','Female','Other']
    # the dropped (base) category depends on alphabetical order: Female, Male, Other
    # drop_first=True drops 'Female' -> columns are gender_Male, gender_Other
    # so is_female_reproductive: NOT (gender_Male or gender_Other) AND age <= 50
    is_male  = df.get('gender_Male',  pd.Series([0])).fillna(0)
    is_other = df.get('gender_Other', pd.Series([0])).fillna(0)
    is_female = ((is_male == 0) & (is_other == 0)).astype(int)
    df['is_female_reproductive'] = (is_female & (df['age'] <= 50)).astype(int)

    # 6. line the columns up with the training feature set
    trained_cols = pipeline['feature_columns']

    # add any columns that were in training but not in this row
    # (can happen for one-hot categories not present in a single-row input)
    for col in trained_cols:
        if col not in df.columns:
            df[col] = 0

    # reorder to the exact training column order, drop any extras
    df = df[trained_cols]

    # 7. scale
    scaler = pipeline['scaler']
    X_scaled = scaler.transform(df)
    return pd.DataFrame(X_scaled, columns=trained_cols)


# shap helper

def _extract_shap_class1(sv) -> np.ndarray:
    """handle both the old (list) and new (3d ndarray) shap output formats."""
    sv_arr = np.array(sv) if not isinstance(sv, np.ndarray) else sv
    if isinstance(sv, list):
        sv_arr = np.array(sv[1] if len(sv) > 1 else sv[0])
    elif sv_arr.ndim == 3:
        sv_arr = sv_arr[:, :, 1]   # (n, f, c) -> (n, f) class-1 slice
    return sv_arr


def get_shap_explanation(model, X_df: pd.DataFrame, feature_cols: List[str], n: int = 8) -> Dict:
    try:
        import shap
        explainer   = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_df)
        sv = _extract_shap_class1(shap_values)
        # sv is (1, n_features) for a single sample, take row 0
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
    # fallback: gbm feature importances
    try:
        imps = model.feature_importances_
        drivers = sorted(
            [{"feature": f, "impact": round(float(v), 5)} for f, v in zip(feature_cols, imps)],
            key=lambda x: x["impact"], reverse=True,
        )
        return {"method": "rf_importance_fallback", "top_risk_drivers": drivers[:n]}
    except Exception as e2:
        return {"method": "unavailable", "error": str(e2), "top_risk_drivers": []}


# endpoints

@app.get("/health")
async def health():
    models_loaded   = A.get("models") is not None
    pipeline_loaded = A.get("pipeline") is not None
    # do not expose file paths, folder structure, or internal layout
    return {
        "status":  "healthy" if models_loaded and pipeline_loaded else "degraded",
        "version": "3.0.0",
    }


@app.post("/predict/risks")
@limiter.limit("30/minute")
async def predict_risks(
    request: Request,
    inp: HealthInput,
    background_tasks: BackgroundTasks,
    is_demo: bool = False,
):
    """run all 7 GradientBoosting models and return a level + score for each target.
    also returns the shap explanation (or feature importances as a fallback).

    every real (non-demo) submission is stored for analytics: the form answers +
    the predicted levels/scores. an assessment_id is returned so a later
    "get recommendations" call can attach its output to this same row.
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

    # preprocess
    try:
        X_scaled = preprocess(inp, pipeline)
    except Exception as e:
        raise HTTPException(422, "Invalid input data. Please check all fields and try again.")

    # predict all 7 targets
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

        # decode the label
        level  = le.inverse_transform([y_pred])[0]

        # weighted risk score 0-100:
        # for each class, multiply its probability by a severity weight.
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

    # shap on the primary model (diabetes)
    primary_model = models.get("diabetes_risk_level")
    explanation = {"method": "unavailable", "top_risk_drivers": []}
    if primary_model is not None:
        explanation = get_shap_explanation(
            primary_model, X_scaled, pipeline["feature_columns"]
        )

    feature_importances = _get_per_model_shap(models, pipeline, X_scaled, inp.dict())

    # store this submission (form + predictions) unless it's a demo run.
    # best effort, in the background, never delays or breaks the response.
    assessment_id = None
    if not is_demo:
        assessment_id = str(uuid.uuid4())
        background_tasks.add_task(
            db.insert_submission, assessment_id, inp.dict(), predictions
        )

    return {
        "status":              "success",
        "assessment_id":       assessment_id,
        "predictions":         predictions,
        "explanation":         explanation,
        "feature_importances": feature_importances,
    }


# recommendations
class RecommendationRequest(BaseModel):
    """echoes the relevant parts of the /predict/risks response back to us.

    the frontend already has both objects after prediction, so no new health data
    is collected here, we just need the risk levels and the per-domain shap drivers
    to build the risk-reduction guidance.

    assessment_id (returned by /predict/risks) links this recommendation back to the
    stored submission, so the full recommendations get saved onto that row. it is
    null for demo submissions (which are never stored)."""
    predictions: Dict[str, Any] = Field(default_factory=dict)
    feature_importances: Dict[str, Any] = Field(default_factory=dict)
    assessment_id: Optional[str] = None


@app.post("/generate/recommendations")
@limiter.limit("20/minute")
async def generate_recommendations(
    request: Request,
    inp: RecommendationRequest,
    background_tasks: BackgroundTasks,
):
    """turn the risk predictions + their shap drivers into risk-reduction
    recommendations (foods / exercise / lifestyle, each split into do-or-eat vs avoid).

    hybrid engine: a curated, vetted substrate supplies the actual health content,
    and gemini selects, de-duplicates, orders by the user's own drivers, and phrases
    it. if gemini is missing or returns junk, we fall back to a deterministic build
    from the same substrate, so this endpoint always returns something useful.
    """
    if not inp.predictions:
        raise HTTPException(422, "No predictions provided. Run a risk assessment first.")

    llm = _gemini_call if A.get("genai_client") is not None else None
    try:
        # run the whole thing (including the blocking gemini call) off the event loop
        result = await asyncio.to_thread(
            recs.generate, inp.predictions, inp.feature_importances or {}, llm
        )
    except Exception:
        # recs.generate has its own fallback so this shouldn't fire, but never let an
        # unexpected error leak to the client.
        raise HTTPException(
            503, "Could not generate recommendations right now. Please try again."
        )

    # best-effort analytics: attach the full recommendations to the stored submission
    # (matched by assessment_id), after the response is sent. demo runs have no
    # assessment_id, so nothing is stored for them.
    if inp.assessment_id:
        background_tasks.add_task(
            db.update_recommendations,
            inp.assessment_id,
            result.get("summary"),
            result.get("source"),
            result,                       # full items: summary + foods/exercise/lifestyle
        )

    return {"status": "success", **result}
