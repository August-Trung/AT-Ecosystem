from __future__ import annotations

from src.core import nlu_ml
from src.core.router import RouteType, route


def test_ml_nlu_routes_fallback_find_file(monkeypatch):
    monkeypatch.setattr(
        nlu_ml,
        "predict_intent",
        lambda text: nlu_ml.NluPrediction(
            intent="find_file",
            confidence=0.91,
            scores={"find_file": 0.91},
        ),
    )

    decision = route("lôi giúp tôi hợp đồng khách hàng")

    assert decision.type == RouteType.FIND_FILE
    assert "hợp đồng" in decision.args["query"]
    assert decision.reason.startswith("ML NLU fallback")


def test_ml_nlu_low_confidence_does_not_route_tool(monkeypatch):
    monkeypatch.setattr(
        nlu_ml,
        "predict_intent",
        lambda text: nlu_ml.NluPrediction(
            intent="delete_file_name",
            confidence=0.86,
            scores={"delete_file_name": 0.86},
        ),
    )

    decision = route("bỏ cái bản nháp kia đi")

    assert decision.type != RouteType.DELETE_FILE_NAME


def test_rule_first_still_wins_over_ml_nlu(monkeypatch):
    monkeypatch.setattr(
        nlu_ml,
        "predict_intent",
        lambda text: nlu_ml.NluPrediction(
            intent="chat",
            confidence=0.99,
            scores={"chat": 0.99},
        ),
    )

    decision = route("mo chrome")

    assert decision.type == RouteType.OPEN_APP
    assert decision.args["app_name"] == "chrome"


def test_ml_nlu_routes_create_reminder(monkeypatch):
    monkeypatch.setattr(
        nlu_ml,
        "predict_intent",
        lambda text: nlu_ml.NluPrediction(
            intent="create_reminder",
            confidence=0.88,
            scores={"create_reminder": 0.88},
        ),
    )

    decision = route("mai báo tôi gửi báo cáo")

    assert decision.type == RouteType.CREATE_REMINDER
    assert "due_at" in decision.args


def test_trained_ml_nlu_routes_toolish_question_before_chat():
    decision = route("hộp thư có gì mới không")

    assert decision.type == RouteType.CHECK_EMAIL


def test_trained_ml_nlu_handles_accented_unseen_reminder():
    decision = route("tối nay đừng quên nhắc tôi gọi khách")

    assert decision.type == RouteType.CREATE_REMINDER


def test_trained_ml_nlu_handles_accented_file_question():
    decision = route("tài liệu kế hoạch nằm đâu rồi")

    assert decision.type == RouteType.FIND_FILE


def test_trained_ml_nlu_keeps_general_question_as_chat():
    decision = route("học máy là gì")

    assert decision.type == RouteType.CHAT
