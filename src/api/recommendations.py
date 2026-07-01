"""
recommendations.py — Risk-reduction recommendation engine.

Design philosophy (hybrid, not pure-LLM):
    The LLM never invents medical claims. We maintain a curated, evidence-aligned
    SUBSTRATE of recommendation building blocks per risk domain. The LLM's only
    job is to SELECT the relevant blocks for whichever risks are elevated for THIS
    user, DEDUPLICATE overlapping advice across domains (so "exercise regularly"
    doesn't appear five times), PRIORITISE by the user's own SHAP drivers, and
    PHRASE it into one coherent summary. If the LLM is unavailable, over quota, or
    returns malformed output, we fall back to a deterministic assembly straight
    from the substrate — so the endpoint always returns something useful.

    This keeps health advice anchored to vetted content while using the LLM for the
    one thing it is genuinely good at here: synthesis across overlapping conditions.

None of the substrate content is novel or controversial — it is standard public-
health guidance (DASH, Mediterranean-style eating, WHO activity guidance, etc.).
It is intentionally non-prescriptive and is paired with a "not medical advice"
disclaimer in the UI.
"""

import json
from typing import Any, Dict, List, Optional


# ── Domain display names ──────────────────────────────────────────────────────
# Used both in the prompt and in the per-item `targets` tags shown in the UI.
DOMAIN_LABELS: Dict[str, str] = {
    "diabetes_risk_level":            "diabetes",
    "heart_disease_risk_level":       "heart disease",
    "hypertension_risk_level":        "high blood pressure",
    "obesity_risk_level":             "obesity",
    "mental_health_risk_level":       "mental wellbeing",
    "respiratory_risk_level":         "respiratory health",
    "general_physical_health_level":  "general fitness",
}

# Which level values count as "elevated" (i.e. worth giving risk-reduction advice).
# Risk domains use Low/Medium/High. general_physical_health uses Poor/Fair/Good/Excellent
# where Poor/Fair are the concerning end.
ELEVATED_LEVELS = {"High", "Medium", "Poor", "Fair"}
# Severity rank for ordering — higher = address first.
SEVERITY_RANK = {"High": 2, "Poor": 2, "Medium": 1, "Fair": 1}


# ── Feature → human-readable label ────────────────────────────────────────────
# Only the modifiable, recommendation-relevant drivers need a friendly label.
# Anything not listed is humanised on the fly (see _humanise_feature).
FEATURE_LABELS: Dict[str, str] = {
    "exercise_level":           "physical activity level",
    "eat_fruits_daily":         "daily fruit intake",
    "eat_veggies_daily":        "daily vegetable intake",
    "eat_processed_food":       "processed-food consumption",
    "water_intake_liters":      "hydration",
    "meal_frequency":           "meal regularity",
    "avg_sleep_hours":          "sleep duration",
    "sleep_deviation":          "irregular sleep",
    "difficulty_falling_asleep": "trouble falling asleep",
    "stress_level":             "stress level",
    "work_stress":              "work-related stress",
    "stress_anxiety_composite": "stress and anxiety",
    "anxiety_level":            "anxiety level",
    "screen_time_hours":        "screen time",
    "sedentary_screen_index":   "sedentary screen time",
    "sun_exposure":             "sunlight exposure",
    "social_interaction_level": "social connection",
    "fatigue_level":            "fatigue",
    "smoking_status":           "smoking",
    "alcohol_consumption":      "alcohol intake",
    "bmi":                      "body mass index (BMI)",
    "bmi_risk_cat":             "BMI category",
    "healthy_diet_score":       "overall diet quality",
    "shortness_of_breath":      "shortness of breath",
    "digestive_issues":         "digestive issues",
    "frequent_headaches":       "frequent headaches",
    "perceived_appetite":       "appetite changes",
    "frequent_urination":       "frequent urination",
    "diabetes_symptom_count":   "diabetes-related symptoms",
}


def _humanise_feature(feat: str) -> str:
    if feat in FEATURE_LABELS:
        return FEATURE_LABELS[feat]
    for prefix in ("diet_type_", "work_type_", "employment_status_", "gender_"):
        if feat.startswith(prefix):
            return feat[len(prefix):].replace("_", " ").strip()
    return feat.replace("_", " ").strip()


# ── Curated recommendation substrate ──────────────────────────────────────────
# Keyed by domain. Each domain holds vetted building blocks. We deliberately key
# by DOMAIN rather than (domain, level): the eat/avoid content for Medium vs High
# diabetes is essentially the same set, differing only in intensity — and intensity
# is handled by passing the level to the LLM as a modifier (gentle nudge for
# Medium/Fair, firmer for High/Poor). This avoids ~21 near-duplicate blocks.
SUBSTRATE: Dict[str, Dict[str, List[str]]] = {
    "diabetes_risk_level": {
        "foods_eat": [
            "High-fibre whole grains (oats, brown rice, whole wheat)",
            "Legumes and pulses (lentils, chickpeas, beans)",
            "Non-starchy vegetables with most meals",
            "Nuts and seeds in moderate portions",
        ],
        "foods_avoid": [
            "Sugar-sweetened beverages and fruit juices",
            "Refined carbohydrates (white bread, white rice, pastries)",
            "Sugary snacks and desserts",
        ],
        "exercise_do": [
            "A 10–15 minute walk after meals to blunt blood-sugar spikes",
            "Regular aerobic activity plus resistance training each week",
        ],
        "exercise_avoid": [
            "Long uninterrupted stretches of sitting — break them up hourly",
        ],
        "lifestyle_do": [
            "Manage weight if above a healthy range",
            "Keep a consistent sleep schedule",
            "Monitor blood glucose if your clinician has advised it",
        ],
        "lifestyle_avoid": [
            "Skipping meals and then over-eating later",
            "Excess alcohol",
        ],
    },
    "heart_disease_risk_level": {
        "foods_eat": [
            "Oily fish rich in omega-3 (salmon, mackerel, sardines)",
            "Olive oil, nuts and seeds as primary fats",
            "Plenty of fruits, vegetables and whole grains",
        ],
        "foods_avoid": [
            "Trans fats and heavily fried foods",
            "Processed and red meats in large amounts",
            "High-sodium packaged and processed foods",
        ],
        "exercise_do": [
            "At least 150 minutes a week of moderate aerobic activity",
            "Brisk walking, cycling or swimming you can sustain",
        ],
        "exercise_avoid": [
            "Sudden intense exertion if you are currently sedentary — build up gradually",
        ],
        "lifestyle_do": [
            "Stop smoking — the single biggest cardiovascular win",
            "Keep blood pressure and cholesterol in check",
            "Build in stress-management routines",
        ],
        "lifestyle_avoid": [
            "Smoking and secondhand smoke",
            "Heavy alcohol intake",
        ],
    },
    "hypertension_risk_level": {
        "foods_eat": [
            "Potassium-rich fruits and vegetables (DASH-style eating)",
            "Low-fat dairy and whole grains",
            "Home-cooked meals where you control the salt",
        ],
        "foods_avoid": [
            "High-sodium processed and packaged foods",
            "Added salt at the table",
            "Salty snacks, pickles and cured foods",
        ],
        "exercise_do": [
            "Regular aerobic activity such as brisk walking or cycling",
            "Light-to-moderate resistance training",
        ],
        "exercise_avoid": [
            "Heavy straining or breath-holding lifts without medical clearance",
        ],
        "lifestyle_do": [
            "Keep daily sodium intake modest",
            "Manage weight and limit alcohol",
            "Prioritise sleep and stress reduction",
        ],
        "lifestyle_avoid": [
            "High alcohol intake",
            "Leaving chronic stress unmanaged",
        ],
    },
    "obesity_risk_level": {
        "foods_eat": [
            "Protein and fibre with each meal to stay full",
            "Vegetables filling half the plate",
            "Sensible, consistent portion sizes",
        ],
        "foods_avoid": [
            "Calorie-dense ultra-processed foods",
            "Sugary drinks and liquid calories",
            "Oversized portions and frequent second helpings",
        ],
        "exercise_do": [
            "Combine aerobic activity with resistance training",
            "Increase everyday movement — steps, stairs, standing breaks",
        ],
        "exercise_avoid": [
            "Long sedentary periods through the day",
        ],
        "lifestyle_do": [
            "Protect 7–9 hours of sleep — poor sleep drives weight gain",
            "Eat mindfully and slow down at meals",
        ],
        "lifestyle_avoid": [
            "Late-night heavy eating",
            "Mindless snacking in front of screens",
        ],
    },
    "mental_health_risk_level": {
        "foods_eat": [
            "A balanced diet with omega-3 sources",
            "Steady meals to avoid blood-sugar crashes that affect mood",
        ],
        "foods_avoid": [
            "Excess caffeine, especially later in the day",
            "Using alcohol as a way to cope",
        ],
        "exercise_do": [
            "Regular physical activity — one of the most reliable mood boosters",
            "Time outdoors or in nature when you can",
        ],
        "exercise_avoid": [
            "Over-training to the point of exhaustion",
        ],
        "lifestyle_do": [
            "Protect consistent, sufficient sleep",
            "Stay socially connected",
            "Practise stress-management (mindfulness, breathing, journalling)",
            "Reach out to a qualified professional if low mood or anxiety persists",
        ],
        "lifestyle_avoid": [
            "Social isolation",
            "Chronic sleep deprivation",
        ],
    },
    "respiratory_risk_level": {
        "foods_eat": [
            "Antioxidant-rich fruits and vegetables",
            "A varied whole-food diet to support immune function",
        ],
        "foods_avoid": [
            "Known personal dietary triggers if you have asthma",
            "Heavily processed foods",
        ],
        "exercise_do": [
            "Gradual aerobic conditioning to build lung capacity",
            "Simple breathing exercises",
        ],
        "exercise_avoid": [
            "Outdoor exertion during high pollution or high pollen days",
        ],
        "lifestyle_do": [
            "Avoid smoking and secondhand smoke entirely",
            "Reduce indoor air pollutants (dust, mould, strong fumes)",
            "Follow any prescribed inhaler or medication plan",
        ],
        "lifestyle_avoid": [
            "Smoking",
            "Exposure to known irritants and allergens",
        ],
    },
    "general_physical_health_level": {
        "foods_eat": [
            "A balanced whole-food diet across food groups",
            "Adequate daily hydration",
        ],
        "foods_avoid": [
            "Relying on ultra-processed convenience foods",
        ],
        "exercise_do": [
            "Build a baseline of activity gradually",
            "Mix cardio, strength and mobility work",
        ],
        "exercise_avoid": [
            "Doing too much too soon and risking injury",
        ],
        "lifestyle_do": [
            "Keep a consistent sleep schedule",
            "Take regular movement breaks through the day",
            "Stay up to date with routine health checkups",
        ],
        "lifestyle_avoid": [
            "Prolonged sitting",
            "Neglecting rest and recovery",
        ],
    },
}

# Maps the substrate's six block keys onto the output schema's category/direction.
_BLOCK_TO_OUTPUT = {
    "foods_eat":      ("foods", "eat"),
    "foods_avoid":    ("foods", "avoid"),
    "exercise_do":    ("exercise", "do"),
    "exercise_avoid": ("exercise", "avoid"),
    "lifestyle_do":   ("lifestyle", "do"),
    "lifestyle_avoid": ("lifestyle", "avoid"),
}

DISCLAIMER = (
    "These suggestions are general, educational wellness information generated from "
    "your inputs — not a medical diagnosis or treatment plan. Always consult a "
    "qualified healthcare professional before making significant changes."
)


# ── Identify elevated risks + the user's personal modifiable drivers ──────────
def _elevated_domains(predictions: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return elevated domains, most-severe first."""
    out = []
    for domain, label in DOMAIN_LABELS.items():
        level = predictions.get(domain)
        if level in ELEVATED_LEVELS:
            out.append({
                "domain": domain,
                "label":  label,
                "level":  level,
                "rank":   SEVERITY_RANK.get(level, 1),
            })
    out.sort(key=lambda d: d["rank"], reverse=True)
    return out


def _top_drivers(
    feature_importances: Dict[str, List[Dict[str, Any]]],
    domain: str,
    k: int = 4,
) -> List[str]:
    """Top MODIFIABLE SHAP drivers for a domain, as readable labels.

    We only surface modifiable drivers — there is no point recommending the user
    change their age or family history."""
    rows = feature_importances.get(domain, []) or []
    labels: List[str] = []
    for r in rows:
        if not r.get("is_modifiable", True):
            continue
        lab = _humanise_feature(r.get("feature", ""))
        if lab and lab not in labels:
            labels.append(lab)
        if len(labels) >= k:
            break
    return labels


# ── Prompt construction ───────────────────────────────────────────────────────
SYSTEM_INSTRUCTION = (
    "You are a careful health-education assistant for a risk-reduction tool. "
    "You DO NOT invent medical claims. You are given vetted recommendation "
    "building blocks and your job is to select, merge, de-duplicate, prioritise "
    "and phrase them for one specific user. Never diagnose, never prescribe "
    "medication or dosages, never promise outcomes. Keep a warm, plain, "
    "encouraging tone. Output VALID JSON ONLY, no markdown, no commentary."
)


def _build_prompt(
    elevated: List[Dict[str, Any]],
    drivers_by_domain: Dict[str, List[str]],
) -> str:
    """Assemble the user-specific prompt from elevated domains + their drivers
    + the relevant substrate blocks."""
    lines: List[str] = []
    lines.append("USER RISK PROFILE (elevated areas, most important first):")
    for e in elevated:
        sev = "HIGH" if e["rank"] == 2 else "MODERATE"
        drv = drivers_by_domain.get(e["domain"], [])
        drv_txt = ", ".join(drv) if drv else "no specific modifiable driver stood out"
        lines.append(
            f"- {e['label']} — {sev} risk. "
            f"This user's main modifiable drivers: {drv_txt}."
        )

    lines.append("\nVETTED RECOMMENDATION MATERIAL (use ONLY this content):")
    for e in elevated:
        blocks = SUBSTRATE[e["domain"]]
        lines.append(f"\n[{e['label']}]")
        lines.append(f"  Foods to eat: {blocks['foods_eat']}")
        lines.append(f"  Foods to avoid: {blocks['foods_avoid']}")
        lines.append(f"  Exercise to do: {blocks['exercise_do']}")
        lines.append(f"  Exercise to avoid: {blocks['exercise_avoid']}")
        lines.append(f"  Lifestyle to do: {blocks['lifestyle_do']}")
        lines.append(f"  Lifestyle to avoid: {blocks['lifestyle_avoid']}")

    lines.append(
        "\nTASK:\n"
        "1. Write a short `summary` (2–4 sentences) that explains, in plain "
        "language, which areas are elevated and ties them to this user's actual "
        "drivers listed above. Lead with the highest-risk area.\n"
        "2. Produce de-duplicated recommendations. If the same advice helps "
        "several areas, include it ONCE and tag ALL the areas it helps in "
        "`targets`. Order items so the ones addressing this user's drivers and "
        "highest-risk areas come first.\n"
        "3. Only use the vetted material above — do not add new foods, exercises "
        "or claims. Lightly rephrase for warmth, but keep the meaning.\n\n"
        "Return JSON EXACTLY in this shape:\n"
        "{\n"
        '  "summary": "string",\n'
        '  "recommendations": {\n'
        '    "foods":     {"eat": [{"text": "string", "targets": ["area", ...]}], "avoid": [...]},\n'
        '    "exercise":  {"do":  [...], "avoid": [...]},\n'
        '    "lifestyle": {"do":  [...], "avoid": [...]}\n'
        "  }\n"
        "}\n"
        "`targets` values must be drawn from these area names only: "
        f"{[e['label'] for e in elevated]}."
    )
    return "\n".join(lines)


# ── Output validation / repair ────────────────────────────────────────────────
_CATEGORIES = {
    "foods":     ("eat", "avoid"),
    "exercise":  ("do", "avoid"),
    "lifestyle": ("do", "avoid"),
}


def _clean_item(item: Any, valid_targets: set) -> Optional[Dict[str, Any]]:
    """Coerce one recommendation item into {text, targets}; drop if unusable."""
    if isinstance(item, str):
        text, targets = item.strip(), []
    elif isinstance(item, dict):
        text = str(item.get("text", "")).strip()
        raw_targets = item.get("targets", []) or []
        targets = [t for t in raw_targets if t in valid_targets]
    else:
        return None
    if not text:
        return None
    return {"text": text, "targets": targets}


def _validate(data: Any, valid_targets: set) -> Optional[Dict[str, Any]]:
    """Return a clean output dict, or None if the structure is unsalvageable."""
    if not isinstance(data, dict):
        return None
    summary = str(data.get("summary", "")).strip()
    recs_in = data.get("recommendations")
    if not summary or not isinstance(recs_in, dict):
        return None

    recs_out: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}
    total_items = 0
    for cat, directions in _CATEGORIES.items():
        cat_in = recs_in.get(cat, {}) or {}
        recs_out[cat] = {}
        for direction in directions:
            items = cat_in.get(direction, []) if isinstance(cat_in, dict) else []
            cleaned = []
            seen = set()
            for it in (items or []):
                ci = _clean_item(it, valid_targets)
                if ci and ci["text"].lower() not in seen:
                    seen.add(ci["text"].lower())
                    cleaned.append(ci)
            recs_out[cat][direction] = cleaned
            total_items += len(cleaned)

    if total_items == 0:
        return None
    return {"summary": summary, "recommendations": recs_out}


# ── Deterministic fallback (no LLM) ───────────────────────────────────────────
def _deterministic(elevated: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Assemble recommendations straight from the substrate, de-duplicated, with
    every contributing area tagged. Used when the LLM is unavailable or invalid."""
    out: Dict[str, Dict[str, List[Dict[str, Any]]]] = {
        cat: {d: [] for d in dirs} for cat, dirs in _CATEGORIES.items()
    }
    # text(lower) -> item ref, so we can append targets when advice repeats.
    index: Dict[str, Dict[str, Any]] = {}

    for e in elevated:  # already severity-sorted
        for block_key, texts in SUBSTRATE[e["domain"]].items():
            cat, direction = _BLOCK_TO_OUTPUT[block_key]
            for text in texts:
                key = f"{cat}|{direction}|{text.lower()}"
                if key in index:
                    if e["label"] not in index[key]["targets"]:
                        index[key]["targets"].append(e["label"])
                else:
                    item = {"text": text, "targets": [e["label"]]}
                    index[key] = item
                    out[cat][direction].append(item)

    # Cap each direction so the safety-net output stays readable. `elevated` is
    # severity-sorted and items were appended in that order, so truncation keeps
    # the highest-severity advice.
    MAX_PER_DIRECTION = 6
    for cat, dirs in out.items():
        for direction in dirs:
            out[cat][direction] = out[cat][direction][:MAX_PER_DIRECTION]

    if elevated:
        top = elevated[0]["label"]
        summary = (
            f"Your results point to elevated {top}"
            + (f" along with {len(elevated) - 1} other area(s)" if len(elevated) > 1 else "")
            + ". The suggestions below focus on the changes most likely to bring "
            "that risk down."
        )
    else:
        summary = "Your results look broadly healthy."
    return {"summary": summary, "recommendations": out}


def _maintenance() -> Dict[str, Any]:
    """Positive response when nothing is elevated."""
    g = SUBSTRATE["general_physical_health_level"]
    def wrap(texts):
        return [{"text": t, "targets": ["general fitness"]} for t in texts]
    return {
        "summary": (
            "Good news — none of your risk areas came back elevated. The habits "
            "below will help you maintain that across the board."
        ),
        "recommendations": {
            "foods":     {"eat": wrap(g["foods_eat"]),     "avoid": wrap(g["foods_avoid"])},
            "exercise":  {"do":  wrap(g["exercise_do"]),   "avoid": wrap(g["exercise_avoid"])},
            "lifestyle": {"do":  wrap(g["lifestyle_do"]),  "avoid": wrap(g["lifestyle_avoid"])},
        },
    }


# ── Public entry point ────────────────────────────────────────────────────────
def generate(
    predictions: Dict[str, Any],
    feature_importances: Dict[str, List[Dict[str, Any]]],
    llm_call=None,
) -> Dict[str, Any]:
    """
    Build risk-reduction recommendations.

    Args:
        predictions:          the `predictions` dict from /predict/risks.
        feature_importances:  the `feature_importances` dict from /predict/risks.
        llm_call:             optional callable (system_instruction, prompt) -> str
                              returning raw model text. If None, or if it raises /
                              returns invalid JSON, we fall back deterministically.

    Returns a dict: {summary, recommendations, source, disclaimer}.
    """
    elevated = _elevated_domains(predictions)

    if not elevated:
        result = _maintenance()
        result["source"] = "maintenance"
        result["disclaimer"] = DISCLAIMER
        return result

    drivers_by_domain = {e["domain"]: _top_drivers(feature_importances, e["domain"]) for e in elevated}
    valid_targets = {e["label"] for e in elevated}

    if llm_call is not None:
        try:
            prompt = _build_prompt(elevated, drivers_by_domain)
            raw = llm_call(SYSTEM_INSTRUCTION, prompt)
            # Strip accidental code fences before parsing.
            cleaned = (raw or "").strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("```", 2)[1]
                if cleaned.lstrip().lower().startswith("json"):
                    cleaned = cleaned.lstrip()[4:]
            data = json.loads(cleaned)
            validated = _validate(data, valid_targets)
            if validated is not None:
                validated["source"] = "llm"
                validated["disclaimer"] = DISCLAIMER
                return validated
        except Exception:
            print(f"[recommendations] Gemini call failed: {type(e).__name__}: {e}")
            
    result = _deterministic(elevated)
    result["source"] = "fallback"
    result["disclaimer"] = DISCLAIMER
    return result
