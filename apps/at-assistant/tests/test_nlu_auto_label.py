from __future__ import annotations

from scripts.auto_label_nlu_feedback import safe_auto_label


def record(**overrides):
    base = {
        "text": "hộp thư có gì mới không",
        "result_status": "success",
        "route_type": "check_email",
        "route_source": "rule",
        "route_confidence": 0.95,
        "ml_intent": "check_email",
        "ml_confidence": 0.86,
    }
    base.update(overrides)
    return base


def test_safe_auto_label_accepts_successful_rule_record():
    intent, reason = safe_auto_label(record())

    assert intent == "check_email"
    assert reason == ""


def test_safe_auto_label_accepts_high_confidence_ml_record():
    intent, reason = safe_auto_label(
        record(
            route_type="find_file",
            route_source="ml",
            route_confidence=0.88,
            ml_intent="find_file",
            ml_confidence=0.88,
        )
    )

    assert intent == "find_file"
    assert reason == ""


def test_safe_auto_label_rejects_risky_intent_even_when_successful():
    intent, reason = safe_auto_label(
        record(
            route_type="delete_file_name",
            route_source="ml",
            route_confidence=0.99,
            ml_intent="delete_file_name",
            ml_confidence=0.99,
        )
    )

    assert intent == ""
    assert reason == "risky_intent_delete_file_name"


def test_safe_auto_label_rejects_errors_and_clarify():
    intent, reason = safe_auto_label(record(result_status="need_clarify"))

    assert intent == ""
    assert reason == "result_need_clarify"


def test_safe_auto_label_rejects_fallback():
    intent, reason = safe_auto_label(
        record(route_type="fallback_to_llm", route_source="fallback_llm")
    )

    assert intent == ""
    assert reason == "blocked_route_fallback_to_llm"


def test_safe_auto_label_rejects_unsupported_route_type():
    intent, reason = safe_auto_label(
        record(route_type="set_memory", route_source="rule", route_confidence=0.99)
    )

    assert intent == ""
    assert reason == "unsupported_intent_set_memory"


def test_safe_auto_label_rejects_heuristic_routes():
    intent, reason = safe_auto_label(
        record(route_type="chat", route_source="heuristic", route_confidence=0.95)
    )

    assert intent == ""
    assert reason == "heuristic_requires_review"


def test_safe_auto_label_rejects_mojibake_text():
    intent, reason = safe_auto_label(record(text="má»Ÿ edge"))

    assert intent == ""
    assert reason == "mojibake_text"
