# 🧬 AI Health Coach: Adaptive ML-Driven Health Intelligence System

[![Status: Active Development](https://img.shields.io/badge/Status-Active%20Development-blue.svg)]()

## Project Overview
The AI Health Coach is an end-to-end, adaptive machine learning pipeline designed to move beyond static, rule-based health tracking (like generic BMI calculators). It utilizes a multi-layered ML architecture to predict specific metabolic and cardiovascular risks, cluster users into behavioral phenotypes, and generate medically-bounded, dynamic lifestyle interventions.

**⏳ Currently in active development (Phase 2). The App will be deployed after completion of Phase 2**

## 🚀 Tech Stack

**Backend:**  
![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)
![Uvicorn](https://img.shields.io/badge/Uvicorn-0.28+-222222)
![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)
![Pydantic](https://img.shields.io/badge/Pydantic-2.6+-E92063)

**Machine Learning & Data Science:**  
![scikit-learn](https://img.shields.io/badge/scikit--learn-1.4+-F7931E?logo=scikitlearn&logoColor=white)
![GradientBoostingClassifier](https://img.shields.io/badge/Model-GradientBoostingClassifier-orange)
![K-Means](https://img.shields.io/badge/Clustering-K--Means-blue)
![SHAP](https://img.shields.io/badge/Explainability-SHAP-ff69b4)
![pandas](https://img.shields.io/badge/pandas-2.2+-150458?logo=pandas&logoColor=white)
![NumPy](https://img.shields.io/badge/NumPy-1.26+-013243?logo=numpy&logoColor=white)
![SciPy](https://img.shields.io/badge/SciPy-1.12+-8CAAE6?logo=scipy&logoColor=white)
![Matplotlib](https://img.shields.io/badge/Matplotlib-3.8+-11557C)
![Seaborn](https://img.shields.io/badge/Seaborn-0.13+-76B900)
![joblib](https://img.shields.io/badge/joblib-1.3+-A23B72)

**Frontend:**  
![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-latest-646CFF?logo=vite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript&logoColor=black)
![CSS](https://img.shields.io/badge/CSS3-Custom-1572B6?logo=css3&logoColor=white)

**Data & Storage:**  
![CSV](https://img.shields.io/badge/Data-CSV-lightgrey)
![Excel](https://img.shields.io/badge/Excel-openpyxl-217346?logo=microsoftexcel&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-Dev-003B57?logo=sqlite&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prod-4169E1?logo=postgresql&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/ORM-SQLAlchemy-D71F00)

**Development & Deployment:**  
![Git](https://img.shields.io/badge/Git-Version%20Control-F05032?logo=git&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-Repo-181717?logo=github&logoColor=white)
![pip](https://img.shields.io/badge/pip-Package%20Manager-3776AB?logo=python&logoColor=white)
![npm](https://img.shields.io/badge/npm-Package%20Manager-CB3837?logo=npm&logoColor=white)
![Swagger](https://img.shields.io/badge/API-Swagger%20UI-85EA2D?logo=swagger&logoColor=black)
![ReDoc](https://img.shields.io/badge/API-ReDoc-8A2BE2)

**Phase 2 Additions:**  
![JWT](https://img.shields.io/badge/Auth-JWT-black)
![SQLAlchemy ORM](https://img.shields.io/badge/ORM-SQLAlchemy-D71F00)
![K-Means](https://img.shields.io/badge/Clustering-K--Means-blue)

## System Architecture 
This project follows a production-grade modular ML engineering structure:

1. **Data Pipeline:** Synthetically generated dataset of 75,000 records across 42 input features and 14 target columns (7 risk scores + 7 risk levels). 
* Designed from the ground up using epidemiological sources — correlations, prevalence rates, hard constraints (HC-01 to HC-15), and interaction effects are fully specified in `feature_reference.xlsx` at the project root. 
* Generation followed a 16-step pipeline covering demographics, anthropometrics, lifestyle, diet, symptoms, and risk score computation via weighted formulas with Gaussian noise. 
* Preprocessing covers ordinal encoding, binary encoding, one-hot encoding (drop_first), and 10 engineered features (BMI risk category, sleep deviation, sedentary screen index, stress-anxiety composite, diabetes symptom count, family history load, healthy diet score, age decade, BMI-age interaction, and female reproductive age flag).
* Dataset specification: `feature_reference.xlsx` (project root) — contains Feature Reference, Target Variables, Risk Score Weights, Hard Constraints, Key Correlations, Encoding Strategy, Generation Pipeline, Risk Matrix, and Generation Config sheets.
2. **Supervised Inference (Risk Prediction):** Seven **Gradient Boosting Classifiers** (one per health domain) that output calibrated 0–100 risk scores for Diabetes, Heart Disease, Hypertension, Obesity, Respiratory, Mental Health, and Overall Physical Health—each with suppressed modifiable factors and guaranteed visibility rules for key drivers.
3. **Unsupervised Personalization (Phase 2):** **K-Means Clustering** applied to lifestyle features (sleep, exercise, screen time, diet) to assign users to archetypes (e.g., "The Stressed Desk Worker", "The Weekend Warrior") and enable cohort-level recommendation strategies.
4. **Explainable AI (XAI):** Per-sample **SHAP (SHapley Additive exPlanations)** analysis via TreeExplainer that identifies modifiable vs. non-modifiable risk drivers, semantic suppression of irrelevant factors (e.g., smoking history if Never selected), and interactive modal explanations with visual gauges and plain-English summaries.
5. **Adaptive Feedback Loop (Phase 2 onwards):** Time-series tracking of user plan adherence and goal weight progress to detect metabolic plateaus and dynamically recalibrate personalized nutrition/workout targets with contextual messaging.

## Repository Structure

```bash
ai-health-coach/
├── data/										# Raw and processed datasets (Ignored in Git)
├── frontend/									# Phase 1 
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── UnifiedForm.jsx
│   │   │   ├── PlanQuestionnaire.jsx
│   │   │   └── PlanView.jsx
│   │   ├── App.jsx
│   │   └── api.js
│   ├── package.json
│   └── vite.config.js
├── notebooks/									# Jupyter notebooks for EDA and Preprocessing
│   ├── eda_health_dataset.ipynb
│   └── preprocessing_ml_pipeline.ipynb
├── src/
│   ├── api/
│   │   └── main.py                             # FastAPI backend (v3.0)
│   └── saved_models/							# Training scripts
├── feature_reference_v2.xlsx                   # Dataset design specification
└── requirements.txt
```

## Development Roadmap
This project follows a phase wise development:

1. **Phase 1:** 
* ✅ Build frontend interface to collect user inputs for prediction models
* ✅ Integrate backend API to process inputs
* ✅ Generate risk predictions from the backend
* ✅ Display predictions on the frontend
* ✅ Fine Tune Prediction Models (In Progress)
* ✅ Implement Explainable AI using SHAP for risk interpretation

2. **Phase 2: (Current Phase)** 
* ⏳ Introduce a database layer for persistent storage (In Progress)
* Enable multi-user support and Implement user authentication (login/signup)
* Store individual user data (inputs + predictions)
* Define lifestyle archetypes and cluster Users for personalized recommendations
* Apply clustering using K-Means(Group users based on lifestyle features such as Exercise frequency, Sleep habits, Dietary patterns, BMI ,Metabolic indicators)

3. **Phase 3:** 
* Develop a recommendation system: \
	•	Personalized meal plans \
	•	Personalized workout plans
* Allow users to: \
	•	Update their personal details \
	•	Track and manage their plan checklist 

4. **Phase 4:** 
* Implement adaptive learning capabilities
* Periodically recalculate: \
    •	Health risk \
	•	Meal plans \
	•	Workout plans
* Trigger updates based on user adherence percentage

5. **Phase 5:** 
* Build an AI Chatbot specifically trained to the user's data to serve as a Health Companion and AI Assistant .

## Phase 2 Current Status
* Implementing User Database