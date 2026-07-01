"""
db.py — minimal analytics persistence.

Appends one row per real submission to a single flat `submissions` table:
the 42 form answers (one column per question), the 7 risk levels + 7 scores,
and the recommendation summary + source.

Design notes:
- If DATABASE_URL is not set, this module is a silent no-op — the app runs fine
  without a database (local dev, or before Neon is wired up). Same best-effort
  philosophy as the Gemini fallback: analytics must never break the user flow.
- Writes are wrapped so a DB hiccup (e.g. Neon waking from scale-to-zero) is
  logged and swallowed, never raised to the request.
- One flat table, viewed directly in Neon's table editor — no ORM models, no
  migrations. Deliberately simple: the goal is just to collect data.
"""

import os
from typing import Any, Dict, Optional

from sqlalchemy import (
    JSON, Column, DateTime, Float, Integer, MetaData, Table, Text,
    create_engine, func, insert, update,
)
from sqlalchemy.dialects.postgresql import JSONB

# JSONB on Postgres (queryable), plain JSON on other dialects (e.g. SQLite in tests).
_JSON_TYPE = JSON().with_variant(JSONB(), "postgresql")


# ── Field lists (mirror HealthInput in main.py) ───────────────────────────────
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

# Base names → the predictions dict has "{base}_level" (text) and "{base}_score" (float)
RISK_DOMAINS = [
    "diabetes_risk", "heart_disease_risk", "hypertension_risk", "obesity_risk",
    "mental_health_risk", "respiratory_risk", "general_physical_health",
]


# ── Table definition ──────────────────────────────────────────────────────────
_metadata = MetaData()

_columns = [
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("created_at", DateTime(timezone=True), server_default=func.now()),
    # Links the recommendations (added later) back to this submission.
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
# Recommendations — NULL until (and unless) the user clicks "Get Recommendations".
_columns.append(Column("recommendation_summary", Text))
_columns.append(Column("recommendation_source", Text))
_columns.append(Column("recommendations", _JSON_TYPE))  # full items for analytics

submissions = Table("submissions", _metadata, *_columns)


# ── Engine ────────────────────────────────────────────────────────────────────
engine = None  # populated by init_db()


def _normalise_url(url: str) -> str:
    # Some providers hand out the legacy "postgres://" scheme, which SQLAlchemy
    # no longer accepts. Neon uses "postgresql://" already, but normalise anyway.
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


def init_db() -> None:
    """Create the engine and ensure the table exists. Safe to call at startup."""
    global engine
    raw = os.getenv("DATABASE_URL")
    if not raw:
        print("   No DATABASE_URL set — submissions will NOT be stored")
        engine = None
        return
    try:
        engine = create_engine(
            _normalise_url(raw),
            pool_pre_ping=True,   # survives Neon scale-to-zero (drops stale conns)
            pool_recycle=300,
        )
        _metadata.create_all(engine)  # creates `submissions` if it doesn't exist
        print("   Database ready — submissions will be stored")
    except Exception as e:
        print(f"   Database unavailable ({type(e).__name__}) — submissions will NOT be stored")
        engine = None


# ── Safe coercion helpers ─────────────────────────────────────────────────────
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


# ── Save ──────────────────────────────────────────────────────────────────────
def insert_submission(
    assessment_id: str,
    form_data: Dict[str, Any],
    predictions: Dict[str, Any],
) -> None:
    """Append one row at prediction time: the form answers + the 7 levels/scores.
    `recommendations` is left NULL — it gets filled in later IF the user clicks
    "Get Recommendations". Best-effort: any failure is logged and swallowed.

    Meant to run as a FastAPI background task, so it never delays the response."""
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
    """Fill in the recommendations for a previously-inserted submission.
    Best-effort: logged and swallowed on failure. Runs as a background task."""
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
