from app.services.weight_class_buckets import (
    adjust_bucket_for_bodyweight,
    get_ruleset_from_federation,
    normalize_federation_name,
    resolve_bucket_id_with_fallback,
    resolve_meet_bucket_id,
)


def test_amp_uses_modern_ruleset() -> None:
    assert get_ruleset_from_federation("AMP") == "modern"
    assert get_ruleset_from_federation("Powerlifting America") == "modern"


def test_amp_display_name() -> None:
    assert normalize_federation_name("AMP") == "Powerlifting America"


def test_modern_weight_class_resolves_when_federation_hint_is_traditional() -> None:
    bucket_id, ruleset = resolve_bucket_id_with_fallback("male", "traditional", 93)
    assert bucket_id == "m-90-93"
    assert ruleset == "modern"


def test_traditional_weight_class_still_resolves() -> None:
    bucket_id, ruleset = resolve_bucket_id_with_fallback("male", "traditional", 90)
    assert bucket_id == "m-90-93"
    assert ruleset == "traditional"


def test_modern_federation_hint_still_works() -> None:
    bucket_id, ruleset = resolve_bucket_id_with_fallback("male", "modern", 93)
    assert bucket_id == "m-90-93"
    assert ruleset == "modern"


def test_bodyweight_over_class_limit_moves_to_superheavy() -> None:
    bucket_id, ruleset = resolve_meet_bucket_id("male", "modern", 120, 154.0)
    assert bucket_id == "m-superheavy"
    assert ruleset == "modern"


def test_bodyweight_within_class_limit_keeps_bucket() -> None:
    bucket_id, ruleset = resolve_meet_bucket_id("male", "modern", 120, 119.5)
    assert bucket_id == "m-120-125"
    assert ruleset == "modern"


def test_traditional_limit_used_for_traditional_ruleset() -> None:
    bucket_id, ruleset = resolve_meet_bucket_id("male", "traditional", 125, 130.0)
    assert bucket_id == "m-superheavy"
    assert ruleset == "traditional"


def test_adjust_bucket_for_bodyweight_helper() -> None:
    assert adjust_bucket_for_bodyweight("m-120-125", "modern", 154.0, "male") == "m-superheavy"
    assert adjust_bucket_for_bodyweight("m-120-125", "modern", 120.0, "male") == "m-120-125"
    assert adjust_bucket_for_bodyweight("m-superheavy", "modern", 154.0, "male") == "m-superheavy"
