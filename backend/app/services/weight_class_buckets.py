from __future__ import annotations

from typing import Any

RULESETS = ("traditional", "modern")

# Powerlifting America uses modern weight classes. OPL tags those meets as "AMP".
POWERLIFTING_AMERICA_ALIASES = frozenset(
    {
        "powerlifting america",
        "pla",
        "pa",
        "amp",
    }
)
MODERN_FEDERATION_ALIASES = POWERLIFTING_AMERICA_ALIASES

FEDERATION_DISPLAY_NAMES = {
    "amp": "Powerlifting America",
    "pla": "Powerlifting America",
    "pa": "Powerlifting America",
}

WEIGHT_CLASS_BUCKETS: list[dict[str, Any]] = [
    {"id": "f-44", "sex": ["female"], "display": "44kg", "sort_order": 10, "traditional": [44], "modern": []},
    {"id": "f-48", "sex": ["female"], "display": "48kg", "sort_order": 20, "traditional": [48], "modern": []},
    {"id": "f-52", "sex": ["female"], "display": "52kg", "sort_order": 30, "traditional": [52], "modern": [52]},
    {"id": "f-56-57", "sex": ["female"], "display": "56/57kg", "sort_order": 40, "traditional": [56], "modern": [57]},
    {"id": "f-60-63", "sex": ["female"], "display": "60/63kg", "sort_order": 50, "traditional": [60], "modern": [63]},
    {"id": "f-65", "sex": ["female"], "display": "65kg", "sort_order": 60, "traditional": [65], "modern": []},
    {"id": "f-69-70", "sex": ["female"], "display": "69/70kg", "sort_order": 70, "traditional": [70], "modern": [69]},
    {"id": "f-75-76", "sex": ["female"], "display": "75/76kg", "sort_order": 80, "traditional": [75], "modern": [76]},
    {"id": "f-82.5-84", "sex": ["female"], "display": "82.5/84kg", "sort_order": 90, "traditional": [82.5], "modern": [84]},
    {"id": "f-90", "sex": ["female"], "display": "90kg", "sort_order": 100, "traditional": [90], "modern": []},
    {"id": "f-superheavy", "sex": ["female"], "display": "84+/100+kg", "sort_order": 110, "traditional": [100, "100+"], "modern": ["84+"]},
    {"id": "m-52", "sex": ["male", "mx"], "display": "52kg", "sort_order": 10, "traditional": [52], "modern": []},
    {"id": "m-56", "sex": ["male", "mx"], "display": "56kg", "sort_order": 20, "traditional": [56], "modern": []},
    {"id": "m-60", "sex": ["male", "mx"], "display": "60kg", "sort_order": 30, "traditional": [60], "modern": []},
    {"id": "m-66-67.5", "sex": ["male", "mx"], "display": "66/67.5kg", "sort_order": 40, "traditional": [67.5], "modern": [66]},
    {"id": "m-74-75", "sex": ["male", "mx"], "display": "74/75kg", "sort_order": 50, "traditional": [75], "modern": [74]},
    {"id": "m-82.5-83", "sex": ["male", "mx"], "display": "82.5/83kg", "sort_order": 60, "traditional": [82.5], "modern": [83]},
    {"id": "m-90-93", "sex": ["male", "mx"], "display": "90/93kg", "sort_order": 70, "traditional": [90], "modern": [93]},
    {"id": "m-100-105", "sex": ["male", "mx"], "display": "100/105kg", "sort_order": 80, "traditional": [100], "modern": [105]},
    {"id": "m-110", "sex": ["male", "mx"], "display": "110kg", "sort_order": 90, "traditional": [110], "modern": []},
    {"id": "m-120-125", "sex": ["male", "mx"], "display": "120/125kg", "sort_order": 100, "traditional": [125], "modern": [120]},
    {"id": "m-superheavy", "sex": ["male", "mx"], "display": "120+/140+kg", "sort_order": 110, "traditional": [140, "140+"], "modern": ["120+"]},
]

BUCKET_BY_ID = {bucket["id"]: bucket for bucket in WEIGHT_CLASS_BUCKETS}

SUPERHEAVY_BUCKET_BY_SEX = {
    "female": "f-superheavy",
    "male": "m-superheavy",
    "mx": "m-superheavy",
}

# Legacy USAPL women's 67.5kg class split into 65kg and 70kg buckets.
LEGACY_FEMALE_67_5_SPLIT_KG = 65.0


def resolve_legacy_female_67_5_bucket(bodyweight_kg: float | None) -> str:
    if bodyweight_kg is not None and bodyweight_kg <= LEGACY_FEMALE_67_5_SPLIT_KG:
        return "f-65"
    return "f-69-70"


def get_bucket_weight_limit_kg(bucket_id: str | None, ruleset: str | None) -> float | None:
    """Upper bodyweight limit (kg) for a bucket under a ruleset, or None if unlimited."""
    if not bucket_id or str(bucket_id).endswith("-superheavy"):
        return None

    bucket = BUCKET_BY_ID.get(bucket_id)
    if not bucket or ruleset not in RULESETS:
        return None

    numeric_limits: list[float] = []
    for class_token in bucket.get(ruleset, []):
        normalized = normalize_class_token(class_token)
        if isinstance(normalized, float):
            numeric_limits.append(normalized)

    if not numeric_limits:
        return None

    return max(numeric_limits)


def adjust_bucket_for_bodyweight(
    bucket_id: str | None,
    ruleset: str | None,
    bodyweight_kg: float | None,
    sex: str | None,
) -> str | None:
    if not bucket_id or bodyweight_kg is None or bodyweight_kg <= 0 or not sex:
        return bucket_id

    limit = get_bucket_weight_limit_kg(bucket_id, ruleset)
    if limit is None or bodyweight_kg <= limit:
        return bucket_id

    return SUPERHEAVY_BUCKET_BY_SEX.get(sex, bucket_id)


def resolve_meet_bucket_id(
    sex: str | None,
    ruleset: str | None,
    class_token: Any,
    bodyweight_kg: float | None = None,
) -> tuple[str | None, str | None]:
    normalized_sex = normalize_sex(sex)
    normalized_class = normalize_class_token(class_token)
    if normalized_sex == "female" and normalized_class == 67.5:
        resolved_ruleset = ruleset if ruleset in RULESETS else "traditional"
        bucket_id = resolve_legacy_female_67_5_bucket(
            float(bodyweight_kg) if bodyweight_kg is not None else None
        )
        adjusted = adjust_bucket_for_bodyweight(
            bucket_id, resolved_ruleset, bodyweight_kg, normalized_sex
        )
        return adjusted, resolved_ruleset

    bucket_id, resolved_ruleset = resolve_bucket_id_with_fallback(sex, ruleset, class_token)
    if not bucket_id:
        return None, resolved_ruleset

    adjusted = adjust_bucket_for_bodyweight(bucket_id, resolved_ruleset, bodyweight_kg, sex)
    return adjusted, resolved_ruleset


def normalize_class_token(value: Any) -> float | str | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)

    trimmed = str(value).strip().lower().replace(" ", "")
    if not trimmed:
        return None
    if trimmed.endswith("+"):
        return trimmed

    numeric_text = trimmed.replace("kg", "")
    try:
        return float(numeric_text)
    except ValueError:
        return None


def normalize_sex(value: Any) -> str | None:
    normalized = str(value or "").strip().lower()
    if normalized in {"f", "female", "women", "woman"}:
        return "female"
    if normalized in {"m", "male", "men", "man"}:
        return "male"
    if normalized in {"mx", "non-binary", "nonbinary", "nb"}:
        return "mx"
    return None


def normalize_federation_name(federation: Any) -> str | None:
    if federation is None or federation == "":
        return None
    raw = str(federation).strip()
    if not raw:
        return None
    return FEDERATION_DISPLAY_NAMES.get(raw.lower(), raw)


def get_ruleset_from_federation(federation: Any) -> str:
    normalized = str(federation or "").strip().lower()
    if normalized in MODERN_FEDERATION_ALIASES:
        return "modern"
    return "traditional"


CLASS_LOOKUP: dict[tuple[str, str, float | str], str] = {}
for bucket in WEIGHT_CLASS_BUCKETS:
    for sex in bucket["sex"]:
        for ruleset in RULESETS:
            for class_token in bucket[ruleset]:
                normalized = normalize_class_token(class_token)
                if normalized is not None:
                    CLASS_LOOKUP[(sex, ruleset, normalized)] = bucket["id"]


def resolve_bucket_id(
    sex: str | None,
    ruleset: str | None,
    class_token: Any,
) -> str | None:
    normalized_class = normalize_class_token(class_token)
    if not sex or not ruleset or normalized_class is None:
        return None
    return CLASS_LOOKUP.get((sex, ruleset, normalized_class))


def resolve_bucket_id_with_fallback(
    sex: str | None,
    ruleset: str | None,
    class_token: Any,
) -> tuple[str | None, str | None]:
    """Resolve a meet weight class to a canonical bucket, trying both rulesets if needed."""
    if not sex:
        return None, ruleset

    preferred = ruleset if ruleset in RULESETS else "traditional"
    bucket_id = resolve_bucket_id(sex, preferred, class_token)
    if bucket_id:
        return bucket_id, preferred

    alternate = "modern" if preferred == "traditional" else "traditional"
    bucket_id = resolve_bucket_id(sex, alternate, class_token)
    if bucket_id:
        return bucket_id, alternate

    return None, preferred


def resolve_member_bucket_id(member: dict[str, Any]) -> str | None:
    sex = normalize_sex(member.get("sex"))
    if not sex:
        return None

    ruleset = member.get("ruleset") or get_ruleset_from_federation(member.get("federation"))
    class_token = member.get("weight_class_kg")
    if class_token is None:
        class_token = normalize_class_token(member.get("weight_class"))

    return resolve_bucket_id(sex, ruleset, class_token)


def infer_sex_from_bucket_id(bucket_id: Any) -> str | None:
    if not bucket_id:
        return None
    bucket_key = str(bucket_id).strip().lower()
    if bucket_key.startswith("f-"):
        return "female"
    if bucket_key.startswith("m-"):
        return "male"
    return None
