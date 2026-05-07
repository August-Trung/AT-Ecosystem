from __future__ import annotations

from pathlib import Path

import src.core.engine as engine_module
from src.core import nlu_feedback
from src.core.engine import Engine


def test_nlu_feedback_builds_record_with_prediction():
    record = nlu_feedback.build_record(
        text="tài liệu kế hoạch nằm đâu rồi",
        route_type="find_file",
        route_confidence=0.54,
        route_reason="ML NLU fallback matched intent=find_file.",
        route_args={"query": "tài liệu kế hoạch nằm đâu rồi"},
        result_status="success",
        error_code="",
    )

    assert record.text == "tài liệu kế hoạch nằm đâu rồi"
    assert record.route_source == "ml"
    assert record.ml_intent == "find_file"
    assert record.ml_confidence is not None
    assert record.needs_feedback is True
    assert "low_route_confidence" in record.feedback_reason


def test_nlu_feedback_append_and_read(tmp_path: Path):
    path = tmp_path / "feedback.jsonl"
    record = nlu_feedback.build_record(
        text="x",
        route_type="fallback_to_llm",
        result_status="need_clarify",
    )

    nlu_feedback.append_record(record, path)
    records = nlu_feedback.read_records(path)

    assert len(records) == 1
    assert records[0]["text"] == "x"
    assert records[0]["needs_feedback"] is True


def test_engine_logs_nlu_feedback(monkeypatch):
    captured: list[dict[str, object]] = []

    def fake_log_turn(**kwargs):
        captured.append(kwargs)
        return None

    monkeypatch.setattr(nlu_feedback, "log_turn", fake_log_turn)
    monkeypatch.setattr(
        engine_module,
        "generate_chat_reply",
        lambda message, history=None, cancel_check=None: "Học máy là một lĩnh vực của AI.",
    )

    engine = Engine()
    result = engine.handle_turn("học máy là gì")

    assert result.status.value == "success"
    assert captured
    assert captured[-1]["text"] == "học máy là gì"
    assert captured[-1]["route_type"] == "chat"
    assert captured[-1]["result_status"] == "success"
