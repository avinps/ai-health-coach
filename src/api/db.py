"""saves submissions to a database for later analysis.

each real submission is one row: the 42 form answers, the 7 risk levels + 7
scores, and later the recommendation summary + source.

if DATABASE_URL is not set this module just does nothing, so the app still runs
fine locally or before the db is set up (same idea as the gemini fallback,
analytics should never break the normal flow). db writes are wrapped in
try/except so a hiccup (like neon waking up) is logged and ignored, never raised
to the request. it's one flat table i can look at directly in neon, no orm
models and no migrations, kept simple on purpose since the point is just to
collect data.
"""

import os
from typing import Any, Dict, Optional

from sqlalchemy import (
    JSON, Column, DateTime, Float, Integer, MetaData, Table, Text,
    create_engine, func, insert, update,
)
from sqlalchemy.dialects.postgresql import JSONB

# JSONB on postgres (queryable), plain JSON on anything else like sqlite in tests
_JSON_TYPE = JSON().with_variant(JSONB(), "postgresql")


# these field lists match HealthInput in main.py
FORM_FLOAT = [
    "age", "height_cm", "weight_kg", "bmi",
    "avg_sleep_hours", "screen_time_hours", "water_intake_liters",
]
FORM_INT = [
    "stress_level", "work_stress", "meal_frequency", "anxiety_level", "fatigue_level",
]
FORM_TEXT = [
    "gender", "exercise_level", "diet_type", "eat_fruits_daily", "eat_veggies_daily",
    "eat_processed_food", "metabolism_type", "employment_status", "work_type",
    "alcohol_consumption", "smoking_status", "sun_exposure", "social_interaction_level",
    "shortness_of_breath", "frequent_headaches", "digestive_issues",
    "difficulty_falling_asleep", "perceived_appetite",
    "family_history_diabetes", "family_history_heart_disease",
    "family_history_hypertension", "family_history_obesity", "family_history_pcos",
    "has_asthma", "has_thyroid", "has_allergies",
    "frequent_urination", "slow_wound_healing", "numbness_tingling",
    "menstrual_regularity",
]

# base names. the predictions dict has "{base}_level" (text) and "{base}_score" (float)
RISK_DOMAINS = [
    "diabetes_risk", "heart_disease_risk", "hypertension_risk", "obesity_risk",
    "mental_health_risk", "respiratory_risk", "general_physical_health",
]


# table setup
_metadata = MetaData()

_columns = [
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("created_at", DateTime(timezone=True), server_default=func.now()),
    # links the recommendations (added later) back to this submission
    Column("assessment_id", Text, unique=True, index=True),
]
for _f in FORM_FLOAT:
    _columns.append(Column(_f, Float))
for _f in FORM_INT:
    _columns.append(Column(_f, Integer))
for _f in FORM_TEXT:
    _columns.append(Column(_f, Text))
for _d in RISK_DOMAINS:
    _columns.append(Column(f"{_d}_level", Text))
    _columns.append(Column(f"{_d}_score", Float))
# recommendations stay null until the user actually clicks "get recommendations"
_columns.append(Column("recommendation_summary", Text))
_columns.append(Column("recommendation_source", Text))
_columns.append(Column("recommendations", _JSON_TYPE))  # full items for analytics

submissions = Table("submissions", _metadata, *_columns)


# engine gets set inside init_db()
engine = None


def _normalise_url(url: str) -> str:
    # some providers still hand out the old "postgres://" scheme which sqlalchemy
    # doesn't accept anymore. neon already uses "postgresql://" but fix it anyway.
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


def init_db() -> None:
    """make the engine and create the table if needed. safe to call at startup."""
    global engine
    raw = os.getenv("DATABASE_URL")
    if not raw:
        print("   no DATABASE_URL set, submissions will not be stored")
        engine = None
        return
    try:
        engine = create_engine(
            _normalise_url(raw),
            pool_pre_ping=True,   # handles neon dropping idle connections
            pool_recycle=300,
        )
        _metadata.create_all(engine)  # makes the submissions table if it's missing
        print("   database ready, submissions will be stored")
    except Exception as e:
        print(f"   database not available ({type(e).__name__}), submissions will not be stored")
        engine = None


# small helpers to convert values without crashing on bad input
def _to_float(v: Any) -> Optional[float]:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _to_int(v: Any) -> Optional[int]:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def insert_submission(
    assessment_id: str,
    form_data: Dict[str, Any],
    predictions: Dict[str, Any],
) -> None:
    """save one row at prediction time: the form answers + the 7 levels/scores.
    recommendations get filled in later if the user asks for them. runs as a
    background task so it never slows the response, and any error is just logged."""
    if engine is None:
        return
    try:
        row: Dict[str, Any] = {"assessment_id": assessment_id}
        for f in FORM_FLOAT:
            row[f] = _to_float(form_data.get(f))
        for f in FORM_INT:
            row[f] = _to_int(form_data.get(f))
        for f in FORM_TEXT:
            v = form_data.get(f)
            row[f] = str(v) if v is not None else None
        for d in RISK_DOMAINS:
            row[f"{d}_level"] = predictions.get(f"{d}_level")
            row[f"{d}_score"] = _to_float(predictions.get(f"{d}_score"))

        with engine.begin() as conn:
            conn.execute(insert(submissions).values(**row))
    except Exception as e:
        print(f"[db] insert_submission failed (ignored): {type(e).__name__}: {e}", flush=True)


def update_recommendations(
    assessment_id: str,
    rec_summary: Optional[str],
    rec_source: Optional[str],
    rec_full: Optional[Dict[str, Any]],
) -> None:
    """fill in the recommendations for a row we already inserted. best effort,
    logged and ignored on failure. also runs as a background task."""
    if engine is None or not assessment_id:
        return
    try:
        with engine.begin() as conn:
            conn.execute(
                update(submissions)
                .where(submissions.c.assessment_id == assessment_id)
                .values(
                    recommendation_summary=rec_summary,
                    recommendation_source=rec_source,
                    recommendations=rec_full,
                )
            )
    except Exception as e:
        print(f"[db] update_recommendations failed (ignored): {type(e).__name__}: {e}", flush=True)
