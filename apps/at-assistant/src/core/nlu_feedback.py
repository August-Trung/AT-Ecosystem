from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any

from src.core.app_paths import ensure_runtime_dir, runtime_root
from src.core import nlu_ml


FEEDBACK_RELATIVE_PATH = Path("app_settings") / "nlu_feedback.jsonl"
REVIEW_RELATIVE_PATH = Path("app_settings") / "nlu_feedback_review.csv"


@dataclass(frozen=True)
class FeedbackRecord:
    timestamp: str
    text: str
    route_type: str
    route_source: str
    route_confidence: float | None
    route_reason: str
    route_args: dict[str, Any]
    ml_intent: str
    ml_confidence: float | None
    result_status: str
    error_code: str
    needs_feedback: bool
    feedback_reason: str


def feedback_path() -> Path:
    ensure_runtime_dir("app_settings")
    return runtime_root() / FEEDBACK_RELATIVE_PATH


def review_csv_path() -> Path:
    ensure_runtime_dir("app_settings")
    return runtime_root() / REVIEW_RELATIVE_PATH


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_json_value(value: Any) -> Any:
    try:
        json.dumps(value, ensure_ascii=False)
        return value
    except TypeError:
        if isinstance(value, dict):
            return {str(k): _safe_json_value(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [_safe_json_value(item) for item in value]
        return str(value)


def _route_source(route_type: str, reason: str) -> str:
    reason_lower = (reason or "").lower()
    if reason_lower.startswith("ml nlu fallback"):
        return "ml"
    if route_type == "fallback_to_llm":
        return "fallback_llm"
    if "heuristic" in reason_lower or "natural chat" in reason_lower:
        return "heuristic"
    return "rule"


def _feedback_reason(
    *,
    route_type: str,
    route_source: str,
    route_confidence: float | None,
    ml_confidence: float | None,
    result_status: str,
    error_code: str,
) -> tuple[bool, str]:
    reasons: list[str] = []
    if route_type == "fallback_to_llm":
        reasons.append("fallback_to_llm")
    if result_status in {"error", "cancelled", "need_clarify"}:
        reasons.append(f"result_{result_status}")
    if error_code:
        reasons.append(f"error_{error_code}")
    if route_source == "ml" and route_confidence is not None and route_confidence < 0.7:
        reasons.append("low_route_confidence")
    if route_source != "ml" and ml_confidence is not None and 0.35 <= ml_confidence < 0.7:
        reasons.append("ml_low_or_unused")
    if route_source == "heuristic" and ml_confidence is not None and ml_confidence >= 0.5:
        reasons.append("heuristic_overrode_possible_tool")
    return bool(reasons), ",".join(reasons)


def build_record(
    *,
    text: str,
    route_type: str = "",
    route_confidence: float | None = None,
    route_reason: str = "",
    route_args: dict[str, Any] | None = None,
    result_status: str = "",
    error_code: str = "",
) -> FeedbackRecord:
    prediction = nlu_ml.predict_intent(text)
    ml_intent = prediction.intent if prediction else ""
    ml_confidence = prediction.confidence if prediction else None
    source = _route_source(route_type, route_reason)
    needs_feedback, reason = _feedback_reason(
        route_type=route_type,
        route_source=source,
        route_confidence=route_confidence,
        ml_confidence=ml_confidence,
        result_status=result_status,
        error_code=error_code,
    )
    return FeedbackRecord(
        timestamp=_utc_now_iso(),
        text=text,
        route_type=route_type,
        route_source=source,
        route_confidence=route_confidence,
        route_reason=route_reason,
        route_args=_safe_json_value(route_args or {}),
        ml_intent=ml_intent,
        ml_confidence=ml_confidence,
        result_status=result_status,
        error_code=error_code,
        needs_feedback=needs_feedback,
        feedback_reason=reason,
    )


def append_record(record: FeedbackRecord, path: Path | None = None) -> Path:
    output_path = path or feedback_path()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record.__dict__, ensure_ascii=False, sort_keys=True) + "\n")
    return output_path


def log_turn(**kwargs: Any) -> FeedbackRecord:
    record = build_record(**kwargs)
    append_record(record)
    return record


def read_records(path: Path | None = None) -> list[dict[str, Any]]:
    input_path = path or feedback_path()
    if not input_path.exists():
        return []
    records: list[dict[str, Any]] = []
    with input_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                payload = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(payload, dict):
                records.append(payload)
    return records
