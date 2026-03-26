from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import joblib
import pandas as pd
import shap
from contextlib import asynccontextmanager
import os

models = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("--- 🧠 BOOTING UP AI ENGINE ---")
    MODELS_DIR = os.path.join(os.path.dirname(__file__), '../../models')
    try:
        models['diabetes'] = joblib.load(os.path.join(MODELS_DIR, 'diabetes_model.joblib'))
        models['mental'] = joblib.load(os.path.join(MODELS_DIR, 'mental_health_model.joblib'))
        models['physical'] = joblib.load(os.path.join(MODELS_DIR, 'physical_health_model.joblib'))
        models['cardio'] = joblib.load(os.path.join(MODELS_DIR, 'cardio_model.joblib'))
        models['cdc_scaler'] = joblib.load(os.path.join(MODELS_DIR, 'cdc_scaler.joblib'))
        models['cardio_scaler'] = joblib.load(os.path.join(MODELS_DIR, 'cardio_scaler.joblib'))
        
        xgb_estimator = models['diabetes'].named_estimators_['xgb']
        models['diab_explainer'] = shap.TreeExplainer(xgb_estimator)
        print("✅ Models, Scalers, and Explainers loaded!")
    except Exception as e:
        print(f"❌ ERROR loading assets: {e}")
    yield
    models.clear()

app = FastAPI(title="AI Health Coach API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# --- 1. THE FINAL CDC SCHEMA (14 Features) ---
class CDCUserProfile(BaseModel):
    HighBP: float
    HighChol: float
    BMI: float
    Smoker: float
    Stroke: float
    HeartDiseaseorAttack: float
    PhysActivity: float
    Fruits: float
    Veggies: float
    HvyAlcoholConsump: float
    GenHlth: float
    DiffWalk: float
    Sex: float
    Age: float # Frontend sends raw age, backend handles the bracket

# --- 2. THE FINAL CARDIO SCHEMA (14 Features) ---
class CardioProfile(BaseModel):
    id: float = 0.0 # Dummy ID to satisfy the model's expected column list
    age: float
    sex: float      # Changed from is_male to sex!
    is_smoking: float
    cigsPerDay: float = 0.0
    prevalentStroke: float
    prevalentHyp: float
    diabetes: float
    BMI: float
    
    # Optional Clinicals (With healthy baseline defaults if user leaves blank)
    totChol: Optional[float] = 200.0
    sysBP: Optional[float] = 120.0
    diaBP: Optional[float] = 80.0
    heartRate: Optional[float] = 75.0
    glucose: Optional[float] = 90.0

# Helper: Convert real age to CDC Bracket
def get_cdc_age_bracket(age: float) -> float:
    if age < 25: return 1.0
    elif age < 30: return 2.0
    elif age < 35: return 3.0
    elif age < 40: return 4.0
    elif age < 45: return 5.0
    elif age < 50: return 6.0
    elif age < 55: return 7.0
    elif age < 60: return 8.0
    elif age < 65: return 9.0
    elif age < 70: return 10.0
    elif age < 75: return 11.0
    elif age < 80: return 12.0
    else: return 13.0

@app.post("/predict/cdc-risks")
async def predict_cdc_risks(profile: CDCUserProfile):
    data = profile.model_dump()
    data['Age'] = get_cdc_age_bracket(data['Age'])
    input_df = pd.DataFrame([data])
    
    try:
        # BULLETPROOF ALIGNMENT: SCALER
        scaler_cols = list(models['cdc_scaler'].feature_names_in_)
        for col in scaler_cols:
            if col not in input_df.columns:
                input_df[col] = 0.0 # Inject dummy if scaler demands it
                
        input_df[scaler_cols] = models['cdc_scaler'].transform(input_df[scaler_cols])
        
        # BULLETPROOF ALIGNMENT: MODEL (This is what was missing!)
        model_cols = list(models['diabetes'].feature_names_in_)
        for col in model_cols:
            if col not in input_df.columns:
                input_df[col] = 0.0 # Inject dummy if model demands dropped columns like 'Education'
        
        # Filter back down to ONLY the Final Features the Model expects
        final_df = input_df[model_cols]
        
        diab_risk = models['diabetes'].predict_proba(final_df)[0][1]
        mental_risk = models['mental'].predict_proba(final_df)[0][1]
        phys_risk = models['physical'].predict_proba(final_df)[0][1]
        
        shap_values = models['diab_explainer'].shap_values(final_df)
        feature_impacts = dict(zip(final_df.columns, shap_values[0]))
        top_risk_drivers = sorted(feature_impacts.items(), key=lambda x: x[1], reverse=True)[:3]
        formatted_drivers = [{"feature": k, "impact": round(float(v), 4)} for k, v in top_risk_drivers if v > 0]
        
        return {
            "predictions": {"diabetes": round(float(diab_risk), 4), "mental_health": round(float(mental_risk), 4), "physical_health": round(float(phys_risk), 4)},
            "explanation": {"message": "Primary factors driving this metabolic risk:", "top_risk_drivers": formatted_drivers}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CDC Inference Error: {str(e)}")

@app.post("/predict/cardio-risk")
async def predict_cardio_risk(profile: CardioProfile):
    input_df = pd.DataFrame([profile.model_dump()])
    
    try:
        # 1. BULLETPROOF THE SCALER
        scaler_cols = list(models['cardio_scaler'].feature_names_in_)
        for col in scaler_cols:
            if col not in input_df.columns:
                input_df[col] = 0.0 # Inject missing columns (like leaky data) safely
                
        input_df[scaler_cols] = models['cardio_scaler'].transform(input_df[scaler_cols])
        
        # 2. BULLETPROOF THE MODEL (The Fix)
        model_cols = list(models['cardio'].feature_names_in_)
        for col in model_cols:
            if col not in input_df.columns:
                input_df[col] = 0.0 # Safely inject 0.0 if the model demands dropped columns like 'education'
                
        # Now it is 100% safe to filter
        final_df = input_df[model_cols]
        
        cardio_risk = models['cardio'].predict_proba(final_df)[0][1]
        return {"predictions": {"cardiovascular_disease": round(float(cardio_risk), 4)}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cardio Inference Error: {str(e)}")