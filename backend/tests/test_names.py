from app.utils.names import capitalize_name_part


def test_capitalize_name_part_simple():
    assert capitalize_name_part("JOHN") == "John"
    assert capitalize_name_part("mcgregor") == "Mcgregor"


def test_capitalize_name_part_hyphen_and_apostrophe():
    assert capitalize_name_part("MARY-JANE") == "Mary-Jane"
    assert capitalize_name_part("O'BRIEN") == "O'Brien"


def test_capitalize_name_part_multiple_words():
    assert capitalize_name_part("  jean   luc  ") == "Jean Luc"


def test_capitalize_name_part_empty():
    assert capitalize_name_part("") == ""
    assert capitalize_name_part(None) is None


def test_infer_unanimous_sex_from_bucket_ids():
    from app.services.opl_service import infer_unanimous_sex_from_bucket_ids

    assert infer_unanimous_sex_from_bucket_ids({"f-60-63", "f-69-70"}) == "female"
    assert infer_unanimous_sex_from_bucket_ids({"m-74-75"}) == "male"
    assert infer_unanimous_sex_from_bucket_ids({"f-60-63", "m-74-75"}) is None
    assert infer_unanimous_sex_from_bucket_ids(set()) is None
