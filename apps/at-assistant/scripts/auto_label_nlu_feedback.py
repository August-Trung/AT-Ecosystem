from __future__ import annotations

import argparse
import csv
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.core import nlu_feedback


RISKY_INTENTS = {
    "close_app",
    "delete_file_name",
    "copy_entry",
    "move_entry",
    "send_email",
    "reply_email",
    "delete_reminder",
}

SUPPORTED_INTENTS = {
    "chat",
    "check_email",
    "close_app",
    "complete_reminder",
    "copy_entry",
    "create_reminder",
    "delete_file_name",
    "delete_reminder",
    "find_file",
    "list_reminders",
    "move_entry",
    "open_app",
    "reply_email",
    "send_email",
    "snooze_reminder",
    "update_reminder",
    "web_search",
    "youtube_search",
}

BLOCKED_ROUTE_TYPES = {
    "",
    "fallback_to_llm",
}

MOJIBAKE_MARKERS = ("Ă", "Â", "Ã", "Ä", "Æ", "€", "™", "á»", "áº", "»", "º", "�")

FIELDS = [
    "text",
    "intent",
    "source",
    "route_type",
    "route_source",
    "route_confidence",
    "ml_confidence",
    "feedback_reason",
]


def safe_auto_label(record: dict[str, object]) -> tuple[str, str]:
    text = str(record.get("text") or "").strip()
    if not text:
        return "", "missing_text"
    if _looks_mojibake(text):
        return "", "mojibake_text"

    result_status = str(record.get("result_status") or "").strip()
    if result_status != "success":
        return "", f"result_{result_status or 'unknown'}"

    route_type = str(record.get("route_type") or "").strip()
    if route_type in BLOCKED_ROUTE_TYPES:
        return "", f"blocked_route_{route_type or 'empty'}"

    route_source = str(record.get("route_source") or "").strip()
    route_confidence = _float_or_none(record.get("route_confidence"))
    ml_intent = str(record.get("ml_intent") or "").strip()
    ml_confidence = _float_or_none(record.get("ml_confidence"))

    candidate = ""
    if route_source == "ml":
        candidate = route_type
        if route_confidence is None or route_confidence < 0.82:
            return "", "ml_confidence_too_low"
    elif route_source == "rule":
        candidate = route_type
        if route_confidence is not None and route_confidence < 0.9:
            return "", "rule_confidence_too_low"
    elif route_source == "heuristic":
        return "", "heuristic_requires_review"
    else:
        if ml_intent and ml_confidence is not None and ml_confidence >= 0.9:
            candidate = ml_intent
        else:
            return "", f"unsupported_route_source_{route_source or 'empty'}"

    if not candidate:
        return "", "missing_candidate"
    if candidate not in SUPPORTED_INTENTS:
        return "", f"unsupported_intent_{candidate}"
    if candidate in RISKY_INTENTS:
        return "", f"risky_intent_{candidate}"
    return candidate, ""


def _float_or_none(value: object) -> float | None:
    if value in {None, ""}:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _looks_mojibake(text: str) -> bool:
    return any(marker in text for marker in MOJIBAKE_MARKERS)


def main() -> int:
    parser = argparse.ArgumentParser(description="Auto-label safe NLU feedback records.")
    parser.add_argument("--input", type=Path, default=None, help="Input JSONL path. Defaults to app_settings/nlu_feedback.jsonl.")
    parser.add_argument("--out", type=Path, default=ROOT / "data" / "nlu" / "auto_labeled.csv")
    parser.add_argument("--rejected", type=Path, default=ROOT / "app_settings" / "nlu_auto_label_rejected.csv")
    args = parser.parse_args()

    records = nlu_feedback.read_records(args.input)
    accepted_rows: list[dict[str, object]] = []
    rejected_rows: list[dict[str, object]] = []
    seen: set[tuple[str, str]] = set()

    for record in records:
        intent, reason = safe_auto_label(record)
        text = str(record.get("text") or "").strip()
        if intent:
            key = (text.lower(), intent)
            if key in seen:
                continue
            seen.add(key)
            accepted_rows.append(
                {
                    "text": text,
                    "intent": intent,
                    "source": "auto_feedback",
                    "route_type": record.get("route_type") or "",
                    "route_source": record.get("route_source") or "",
                    "route_confidence": record.get("route_confidence") or "",
                    "ml_confidence": record.get("ml_confidence") or "",
                    "feedback_reason": record.get("feedback_reason") or "",
                }
            )
        else:
            rejected_rows.append(
                {
                    "text": text,
                    "reason": reason,
                    "route_type": record.get("route_type") or "",
                    "route_source": record.get("route_source") or "",
                    "route_confidence": record.get("route_confidence") or "",
                    "ml_intent": record.get("ml_intent") or "",
                    "ml_confidence": record.get("ml_confidence") or "",
                    "result_status": record.get("result_status") or "",
                }
            )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(accepted_rows)

    args.rejected.parent.mkdir(parents=True, exist_ok=True)
    with args.rejected.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "text",
                "reason",
                "route_type",
                "route_source",
                "route_confidence",
                "ml_intent",
                "ml_confidence",
                "result_status",
            ],
        )
        writer.writeheader()
        writer.writerows(rejected_rows)

    print(f"records_read={len(records)}")
    print(f"records_auto_labeled={len(accepted_rows)}")
    print(f"records_rejected={len(rejected_rows)}")
    print(f"output={args.out}")
    print(f"rejected={args.rejected}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
