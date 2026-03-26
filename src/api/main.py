from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
from contextlib import asynccontextmanager
import os

models = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("--- 🧠 BOOTING UP AI ENGINE ---")
    MODELS_DIR = os.path.join(os.path.dirname(__file__), '../../models')
    
    try:
        # 1. Load the Predictive Models
        models['diabetes'] = joblib.load(os.path.join(MODELS_DIR, 'diabetes_model.joblib'))
        models['mental'] = joblib.load(os.path.join(MODELS_DIR, 'mental_health_model.joblib'))
        models['physical'] = joblib.load(os.path.join(MODELS_DIR, 'physical_health_model.joblib'))
        models['cardio'] = joblib.load(os.path.join(MODELS_DIR, 'cardio_model.joblib'))
        
        # 2. Load the Preprocessing Objects (Scalers)
        # UPDATE THESE FILENAMES IF YOURS ARE DIFFERENT
        models['cdc_scaler'] = joblib.load(os.path.join(MODELS_DIR, 'cdc_scaler.joblib'))
        models['cardio_scaler'] = joblib.load(os.path.join(MODELS_DIR, 'cardio_scaler.joblib'))
        
        # (Optional) Load imputers if your backend will accept missing/null values from the frontend
        # models['cardio_cont_imputer'] = joblib.load(os.path.join(MODELS_DIR, 'cardio_cont_imputer.joblib'))
        
        print("✅ Models AND Scalers loaded successfully into memory!")
    except Exception as e:
        print(f"❌ ERROR: Could not load models or scalers.\nDetails: {e}")
    
    yield
    models.clear()

app = FastAPI(title="AI Health Coach API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SCHEMAS ---
class CDCUserProfile(BaseModel):
    HighBP: float
    HighChol: float
    CholCheck: float
    BMI: float
    Smoker: float
    Stroke: float
    HeartDiseaseorAttack: float
    PhysActivity: float
    Fruits: float
    Veggies: float
    HvyAlcoholConsump: float
    AnyHealthcare: float
    NoDocbcCost: float
    GenHlth: float
    DiffWalk: float
    Sex: float
    Age: float
    Education: float
    Income: float

class CardioProfile(BaseModel):
    age: float
    education: float
    is_male: float
    is_smoking: float
    cigsPerDay: float
    BPMeds: float
    prevalentStroke: float
    prevalentHyp: float
    diabetes: float
    totChol: float
    sysBP: float
    diaBP: float
    BMI: float
    heartRate: float
    glucose: float

# --- ENDPOINTS ---
@app.post("/predict/cdc-risks")
async def predict_cdc_risks(profile: CDCUserProfile):
    input_df = pd.DataFrame([profile.model_dump()])
    
    try:
        # APPLY SCALER: Transform only the continuous columns exactly as done in training
        cdc_continuous_cols = ['BMI', 'Age', 'Education', 'Income', 'GenHlth']
        input_df[cdc_continuous_cols] = models['cdc_scaler'].transform(input_df[cdc_continuous_cols])
        
        # Now pass the properly scaled data to the models
        diab_risk = models['diabetes'].predict_proba(input_df)[0][1]
        mental_risk = models['mental'].predict_proba(input_df)[0][1]
        phys_risk = models['physical'].predict_proba(input_df)[0][1]
        
        return {
            "predictions": {
                "diabetes": round(float(diab_risk), 4),
                "mental_health": round(float(mental_risk), 4),
                "physical_health": round(float(phys_risk), 4)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CDC Inference Error: {str(e)}")

@app.post("/predict/cardio-risk")
async def predict_cardio_risk(profile: CardioProfile):
    input_df = pd.DataFrame([profile.model_dump()])
    
    try:
        # 1. ADD THE MISSING DUMMY COLUMNS
        leaky_cols = ['CPK_MB_Percentage', 'Triglyceride', 'hdl_cholestrol', 'ldl_cholestrol']
        for col in leaky_cols:
            input_df[col] = 0.0
            
        # 2. DYNAMIC SCALER ALIGNMENT
        # Ask the scaler exactly what columns it wants and in what order!
        scaler_cols = list(models['cardio_scaler'].feature_names_in_)
        
        # Apply the transformation using that exact locked order
        input_df[scaler_cols] = models['cardio_scaler'].transform(input_df[scaler_cols])
        
        # 3. DYNAMIC MODEL ALIGNMENT
        # Ask the XGBoost/Ensemble model exactly what columns IT wants!
        model_cols = list(models['cardio'].feature_names_in_)
        
        # Slice the dataframe to match the model's exact expected order (ignoring the dummies)
        final_df = input_df[model_cols]
        
        # 4. PREDICT
        cardio_risk = models['cardio'].predict_proba(final_df)[0][1]
        
        return {
            "predictions": {
                "cardiovascular_disease": round(float(cardio_risk), 4)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cardio Inference Error: {str(e)}")