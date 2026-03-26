# 🧬 AI Health Coach: Adaptive ML-Driven Health Intelligence System

[![Status: Active Development](https://img.shields.io/badge/Status-Active%20Development-blue.svg)]()
[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-blue.svg)]()
[![ML Framework: Scikit-Learn | XGBoost](https://img.shields.io/badge/ML-XGBoost%20%7C%20Scikit--Learn-orange)]()

## Project Overview
The AI Health Coach is an end-to-end, adaptive machine learning pipeline designed to move beyond static, rule-based health tracking (like generic BMI calculators). It utilizes a multi-layered ML architecture to predict specific metabolic and cardiovascular risks, cluster users into behavioral phenotypes, and generate medically-bounded, dynamic lifestyle interventions.

**Currently in active development.**

## System Architecture 
This project follows a production-grade modular ML engineering structure:

1. **Data Pipeline:** Robust preprocessing (Imputation, Isolation Forests, SMOTE for class imbalance) mapping diverse datasets (CDC, UCI) into a unified schema. \
Datasets used: 
* CDC Diabetes Health Indicators Dataset: https://www.kaggle.com/datasets/alexteboul/diabetes-health-indicators-dataset 
* Cardiovascular Disease Data: https://ieee-dataport.org/documents/cardiovascular-disease-data 
2. **Supervised Inference (Risk Prediction):** A Soft-Voting Ensemble combining **Logistic Regression, Random Forest, and XGBoost** to output calibrated probabilities for Diabetes, CVD, and Obesity risks.
3. **Unsupervised Personalization:** **K-Means Clustering** applied to behavioral data (sleep, hydration, screen time) to group users into actionable lifestyle personas.
4. **Explainable AI (XAI):** Integration of **SHAP** (SHapley Additive exPlanations) to translate black-box predictions into human-readable feature importance.
5. **Adaptive Feedback Loop:** A time-series analytical engine that tracks user adherence and dynamically recalibrates calorie/workout targets when metabolic plateaus are detected.

## Repository Structure
```bash
ai-health-coach/
├── api/                  # FastAPI backend services 
├── data/                 # Raw and processed datasets (Ignored in Git)
├── frontend/             # Phase 1 
├── notebooks/            # Jupyter notebooks for EDA and model prototyping
└── src/
    ├── data/             # Scripts for cleaning, scaling, and SMOTE
    └── models/           # Training scripts for Ensemble and K-Means
```
## Development Roadmap
This project follows a phase wise development:

1. **Phase 1 (Current Phase):** 
* ✅ Build frontend interface to collect user inputs for prediction models
* ✅ Integrate backend API to process inputs
* ✅ Generate risk predictions from the backend
* ✅ Display predictions on the frontend
* ✅ Implement Explainable AI using SHAP for risk interpretation
* ⏳ Fine Tune Prediction Models (In Progress)

2. **Phase 2:** 
* Introduce a database layer for persistent storage
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

## Phase 1 Current Status
* Model Fine tuning