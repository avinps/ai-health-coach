# 🧬 AI Health Coach: Explainable ML-Driven Health Risk & Recommendation System

[![Status: Live](https://img.shields.io/badge/Status-Live-brightgreen.svg)]()
[![Deployment: Vercel + Render](https://img.shields.io/badge/Deployed-Vercel%20%2B%20Render-black.svg)]()

## Project Overview

AI Health Coach is an end-to-end machine learning application that moves past static, rule-based health tools such as generic BMI calculators. It takes a lifestyle questionnaire, predicts a user's risk across seven health domains, explains the reasoning behind each prediction using explainable AI, and generates medically-bounded, personalised recommendations for reducing those risks.

The system is built around a single, focused loop: **predict, explain, recommend.** Predictions come from seven supervised models, explanations come from per-sample SHAP analysis, and recommendations come from a hybrid engine that pairs a curated medical knowledge base with a large language model. Every real submission is persisted to a database for later analysis.

### The application is live [HERE](https://ai-healthcoach.vercel.app "Visit App") [USE DEMO MODE TO TEST IT OUT IN UNDER 3 MINUTES !].

## 🚀 Tech Stack

**Backend:**  
![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)
![Uvicorn](https://img.shields.io/badge/Uvicorn-0.28+-222222)
![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)
![Pydantic](https://img.shields.io/badge/Pydantic-2.6+-E92063)

**Machine Learning & Data Science:**  
![scikit-learn](https://img.shields.io/badge/scikit--learn-1.8-F7931E?logo=scikitlearn&logoColor=white)
![GradientBoostingClassifier](https://img.shields.io/badge/Model-GradientBoostingClassifier-orange)
![SHAP](https://img.shields.io/badge/Explainability-SHAP-ff69b4)
![pandas](https://img.shields.io/badge/pandas-2.2+-150458?logo=pandas&logoColor=white)
![NumPy](https://img.shields.io/badge/NumPy-2.3-013243?logo=numpy&logoColor=white)
![SciPy](https://img.shields.io/badge/SciPy-1.17-8CAAE6?logo=scipy&logoColor=white)
![Matplotlib](https://img.shields.io/badge/Matplotlib-3.8+-11557C)
![Seaborn](https://img.shields.io/badge/Seaborn-0.13+-76B900)

**AI / LLM:**  
![Google Gemini](https://img.shields.io/badge/LLM-Google%20Gemini-8E75B2?logo=google&logoColor=white)
![google-genai](https://img.shields.io/badge/SDK-google--genai-4285F4?logo=google&logoColor=white)

**Frontend:**  
![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-latest-646CFF?logo=vite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript&logoColor=black)
![CSS](https://img.shields.io/badge/CSS3-Custom-1572B6?logo=css3&logoColor=white)

**Data & Storage:**  
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prod-4169E1?logo=postgresql&logoColor=white)
![Neon](https://img.shields.io/badge/Neon-Serverless%20Postgres-00E599?logo=postgresql&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/ORM-SQLAlchemy-D71F00)
![Excel](https://img.shields.io/badge/Spec-openpyxl-217346?logo=microsoftexcel&logoColor=white)

**Development & Deployment:**  
![Git](https://img.shields.io/badge/Git-Version%20Control-F05032?logo=git&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-Repo-181717?logo=github&logoColor=white)
![Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render&logoColor=white)

## System Architecture

The project follows a modular, production-style structure across four layers:

1. **Data Pipeline:** A synthetically generated dataset of 75,000 records across 42 input features and 14 target columns (7 risk scores and 7 risk levels).
* The dataset was designed from epidemiological sources, with correlations, prevalence rates, hard constraints, and interaction effects specified in `feature_reference.xlsx` at the project root.
* Generation followed a multi-step pipeline covering demographics, anthropometrics, lifestyle, diet, symptoms, and risk-score computation using weighted formulas with Gaussian noise.
* Preprocessing covers ordinal, binary, and one-hot encoding, along with 10 engineered features (including BMI risk category, sleep deviation, sedentary screen index, stress-anxiety composite, diabetes symptom count, family history load, and healthy diet score).

2. **Supervised Inference (Risk Prediction):** Seven **Gradient Boosting Classifiers**, one per health domain, that output a level and a 0–100 score for Diabetes, Heart Disease, Hypertension, Obesity, Respiratory Health, Mental Wellbeing, and Overall Physical Health. Training each model independently allowed every domain to be tuned on its own.

3. **Explainable AI (XAI):** Per-sample **SHAP (SHapley Additive exPlanations)** analysis using TreeExplainer, identifying modifiable versus non-modifiable risk drivers. A semantic suppression layer removes factors that do not apply to a given user (for example, smoking is hidden if the user has never smoked, and BMI features are hidden when BMI is in a healthy range), while a set of key drivers is always surfaced when relevant. The output is presented as interactive explanations with visual gauges and plain-English summaries rather than raw scores.

4. **Recommendation Engine (Hybrid LLM + Rules):** A two-part system that generates risk-reduction guidance without allowing the model to invent medical claims.
* A curated, evidence-based knowledge base of vetted guidance (DASH-style eating, standard activity guidance, and similar) is held on the backend.
* **Google Gemini** does not author advice directly. It selects the relevant items for the user's elevated risks, removes overlap, prioritises by the user's own SHAP drivers, and phrases the result.
* If the model is unavailable, rate-limited, or returns malformed output, the engine falls back to assembling recommendations from the same knowledge base, with a short retry on transient errors. The endpoint always returns a valid, grounded result.

5. **Analytics Persistence:** Every real submission (form inputs, predicted levels and scores, and the generated recommendations) is written to a **PostgreSQL** database via **SQLAlchemy**. Demo submissions are excluded. Writes run as background tasks after the response is returned, so persistence never adds latency, and a database outage never affects the user-facing flow.

## Repository Structure

```bash
ai-health-coach/
├── data/                                   # Raw and processed datasets (Ignored in Git)
├── frontend/                               # React + Vite client
│   ├── src/
│   │   ├── components/
│   │   │   ├── UnifiedForm.jsx             # Questionnaire
│   │   │   ├── Dashboard.jsx               # Risk results + SHAP explanations
│   │   │   └── RecommendationsView.jsx     # Foods / exercise / lifestyle guidance
│   │   ├── App.jsx
│   │   └── api.js
│   ├── package.json
│   └── vite.config.js
├── notebooks/                              # Jupyter notebooks for EDA and Preprocessing
│   ├── eda_health_dataset.ipynb
│   └── preprocessing_ml_pipeline.ipynb
├── src/
│   ├── api/
│   │   ├── main.py                         # FastAPI backend: prediction + SHAP endpoints
│   │   ├── recommendations.py             # Hybrid Gemini + rule-based engine
│   │   └── db.py                           # PostgreSQL persistence (SQLAlchemy)
│   └── saved_models/                       # Trained models + preprocessing pipeline
├── feature_reference.xlsx                  # Dataset design specification
├── requirements.txt
└── runtime.txt                             # Pinned Python version for reproducible builds
```

## Engineering Notes

A few design decisions that shaped the system:

* **Graceful degradation.** The LLM layer, the database, and model loading each have fallbacks. If any one is unavailable, the user still receives a useful result. This was driven by running the application on free-tier infrastructure and handling each of these failure modes in practice.
* **Bounded AI.** The language model only ever selects and rephrases pre-approved content, so it cannot fabricate a medical claim. This keeps the health guidance trustworthy.
* **Personalised explanations.** Because of the suppression logic, two users with the same risk level can see different explanations based on their own inputs.
* **Reproducible deployment.** The trained models are pickled, so scikit-learn, NumPy, SciPy, and the Python version are pinned exactly. A newer library version silently breaks older model pickles, and pinning keeps deployments stable.

## Running Locally

**Backend**

```bash
pip install -r requirements.txt

# Optional environment variables (the app runs without them, using fallbacks)
export GEMINI_API_KEY=your_key        # Enables AI-written recommendations
export DATABASE_URL=your_neon_url     # Enables submission storage
export ALLOWED_ORIGINS=http://localhost:5173

uvicorn src.api.main:app --reload --port 8000
```

Without `GEMINI_API_KEY`, recommendations still work through the rule-based fallback. Without `DATABASE_URL`, the application runs normally and simply does not store submissions.

**Frontend**

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env.local
npm run dev
```

## Development Roadmap

The current release delivers the complete predict, explain, and recommend loop with analytics persistence. Planned future work includes:

* User accounts and authentication for longitudinal tracking of results over time.
* Lifestyle archetypes via K-Means clustering to enable cohort-level recommendation strategies.
* A progress-tracking view for users to monitor changes across repeated assessments.
