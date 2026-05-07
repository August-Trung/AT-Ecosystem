from __future__ import annotations

import argparse
import csv
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.core import nlu_feedback


FIELDS = [
    "text",
    "predicted_intent",
    "route_type",
    "route_source",
    "route_confidence",
    "ml_confidence",
    "result_status",
    "error_code",
    "feedback_reason",
    "correct_intent",
    "notes",
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Export NLU feedback JSONL to a review CSV.")
    parser.add_argument("--input", type=Path, default=None, help="Input JSONL path. Defaults to app_settings/nlu_feedback.jsonl.")
    parser.add_argument("--out", type=Path, default=None, help="Output CSV path. Defaults to app_settings/nlu_feedback_review.csv.")
    parser.add_argument("--all", action="store_true", help="Export all records, not only records marked needs_feedback.")
    args = parser.parse_args()

    records = nlu_feedback.read_records(args.input)
    output_path = args.out or nlu_feedback.review_csv_path()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    seen: set[str] = set()
    exported = 0
    with output_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        for record in records:
            if not args.all and not bool(record.get("needs_feedback")):
                continue
            text = str(record.get("text") or "").strip()
            if not text or text.lower() in seen:
                continue
            seen.add(text.lower())
            predicted = str(record.get("ml_intent") or record.get("route_type") or "")
            writer.writerow(
                {
                    "text": text,
                    "predicted_intent": predicted,
                    "route_type": record.get("route_type") or "",
                    "route_source": record.get("route_source") or "",
                    "route_confidence": record.get("route_confidence") or "",
                    "ml_confidence": record.get("ml_confidence") or "",
                    "result_status": record.get("result_status") or "",
                    "error_code": record.get("error_code") or "",
                    "feedback_reason": record.get("feedback_reason") or "",
                    "correct_intent": "",
                    "notes": "",
                }
            )
            exported += 1

    print(f"records_read={len(records)}")
    print(f"records_exported={exported}")
    print(f"output={output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
