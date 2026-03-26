# 🧬 AI Health Coach: Adaptive ML-Driven Health Intelligence System

[![Status: Active Development](https://img.shields.io/badge/Status-Active%20Development-blue.svg)]()
[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-blue.svg)]()
[![ML Framework: Scikit-Learn | XGBoost](https://img.shields.io/badge/ML-XGBoost%20%7C%20Scikit--Learn-orange)]()

## 📌 Project Overview
The AI Health Coach is an end-to-end, adaptive machine learning pipeline designed to move beyond static, rule-based health tracking (like generic BMI calculators). It utilizes a multi-layered ML architecture to predict specific metabolic and cardiovascular risks, cluster users into behavioral phenotypes, and generate medically-bounded, dynamic lifestyle interventions.

**Currently in active development.**

## 🏗️ System Architecture 
This project follows a production-grade modular ML engineering structure:

1. **Data Pipeline:** Robust preprocessing (KNN Imputation, Isolation Forests, SMOTE for class imbalance) mapping diverse datasets (CDC, UCI) into a unified schema.
2. **Supervised Inference (Risk Prediction):** A Soft-Voting Ensemble combining **Logistic Regression, Random Forest, and XGBoost** to output calibrated probabilities for Diabetes, CVD, and Obesity risks.
3. **Unsupervised Personalization:** **K-Means Clustering** applied to behavioral data (sleep, hydration, screen time) to group users into actionable lifestyle personas.
4. **Explainable AI (XAI):** Integration of **SHAP** (SHapley Additive exPlanations) to translate black-box predictions into human-readable feature importance.
5. **Adaptive Feedback Loop:** A time-series analytical engine that tracks user adherence and dynamically recalibrates calorie/workout targets when metabolic plateaus are detected.

## 📂 Repository Structure
```bash
ai-health-coach/
├── api/                  # FastAPI backend services (Planned)
├── data/                 # Raw and processed datasets (Ignored in Git)
├── frontend/             # Streamlit user dashboard (Planned)
├── notebooks/            # Jupyter notebooks for EDA and model prototyping
└── src/
    ├── data/             # Scripts for cleaning, scaling, and SMOTE
    └── models/           # Training scripts for Ensemble and K-Means
```
## 🚀 Current Phase
* Architecting the unified data schema.
* Model Building and evaluation