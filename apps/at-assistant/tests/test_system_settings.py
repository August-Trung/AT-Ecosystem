from src.core.system_settings import build_wakeword_rules


def test_build_wakeword_rules_from_phrase():
    rules = build_wakeword_rules("Hải ơi")

    assert rules["wakeword_allowed_variants"] == [
        "hai oi",
        "hai oi a",
        "hai oi oi",
    ]
    assert "ai oi" in rules["wakeword_reject_phrases"]


def test_build_wakeword_rules_for_custom_phrase():
    rules = build_wakeword_rules("Anna ơi")

    assert rules["wakeword_allowed_variants"] == [
        "anna oi",
        "anna oi a",
        "anna oi oi",
    ]
    assert rules["wakeword_reject_phrases"] == []
