from app.services.dots import calculate_dots


def test_calculate_dots_male_intermediate() -> None:
    # Reference: everycalc.io — male 83 kg, 500 kg total ≈ 338 DOTS
    score = calculate_dots(500, 83, "male")
    assert score is not None
    assert 335 <= score <= 341


def test_calculate_dots_female_advanced() -> None:
    # Reference: everycalc.io — female 63 kg, 350 kg total ≈ 376 DOTS
    score = calculate_dots(350, 63, "female")
    assert score is not None
    assert 373 <= score <= 379


def test_calculate_dots_requires_valid_inputs() -> None:
    assert calculate_dots(0, 83, "male") is None
    assert calculate_dots(500, 0, "male") is None
    assert calculate_dots(500, 83, "unknown") is None
    assert calculate_dots(500, 30, "male") is None


def test_calculate_dots_mx_uses_male_coefficients() -> None:
    assert calculate_dots(500, 83, "mx") == calculate_dots(500, 83, "male")
