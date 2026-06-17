from __future__ import annotations

from typing import Any

from app.services.weight_class_buckets import normalize_sex

# IPF DOTS (2020) polynomial coefficients: denom = A + B*BW + C*BW² + D*BW³ + E*BW⁴
_DOTS_COEFFICIENTS: dict[str, tuple[float, float, float, float, float]] = {
    "male": (-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093),
    "female": (-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706),
}

_DOTS_BODYWEIGHT_LIMITS: dict[str, tuple[float, float]] = {
    "male": (40.0, 210.0),
    "female": (40.0, 150.0),
}


def _dots_sex_key(sex: Any) -> str | None:
    normalized = normalize_sex(sex)
    if normalized == "female":
        return "female"
    if normalized in {"male", "mx"}:
        return "male"
    return None


def calculate_dots(total_kg: float, bodyweight_kg: float, sex: str) -> float | None:
    """Return IPF DOTS score for a meet total, or None when inputs are invalid."""
    if total_kg <= 0 or bodyweight_kg <= 0:
        return None

    sex_key = _dots_sex_key(sex)
    if sex_key is None:
        return None

    min_bw, max_bw = _DOTS_BODYWEIGHT_LIMITS[sex_key]
    if bodyweight_kg < min_bw or bodyweight_kg > max_bw:
        return None

    coefficient_a, coefficient_b, coefficient_c, coefficient_d, coefficient_e = (
        _DOTS_COEFFICIENTS[sex_key]
    )
    bodyweight = bodyweight_kg
    denominator = (
        coefficient_a
        + coefficient_b * bodyweight
        + coefficient_c * bodyweight**2
        + coefficient_d * bodyweight**3
        + coefficient_e * bodyweight**4
    )
    if denominator <= 0:
        return None

    return round(total_kg * (500.0 / denominator), 2)
