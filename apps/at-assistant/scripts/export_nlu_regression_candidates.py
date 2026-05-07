from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.core import nlu_feedback


DEFAULT_OUTPUT = Path("app_settings") / "nlu_regression_candidates.jsonl"


def _candidate_from_record(record: dict[str, Any]) -> dict[str, Any] | None:
    text = str(record.get("text") or "").strip()
    if not text:
        return None
    route_type = str(record.get("route_type") or "").strip()
    fallback_or_problem = bool(record.get("needs_feedback")) or route_type == "fallback_to_llm"
    if not fallback_or_problem:
        return None
    return {
        "text": text,
        "allowed_types": [],
        "forbidden_types": [],
        "observed_type": route_type,
        "observed_args": record.get("route_args") or {},
        "result_status": record.get("result_status") or "",
        "feedback_reason": record.get("feedback_reason") or "",
        "notes": "Fill allowed_types/forbidden_types, then move into data/nlu/regression_holdout.jsonl.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export feedback rows that should become NLU regression tests."
    )
    parser.add_argument("--input", type=Path, default=None, help="Input feedback JSONL path.")
    parser.add_argument("--out", type=Path, default=ROOT / DEFAULT_OUTPUT, help="Output candidate JSONL path.")
    parser.add_argument("--all", action="store_true", help="Export all feedback records, not only problem rows.")
    args = parser.parse_args()

    records = nlu_feedback.read_records(args.input)
    args.out.parent.mkdir(parents=True, exist_ok=True)

    seen: set[str] = set()
    candidates: list[dict[str, Any]] = []
    for record in records:
        candidate = _candidate_from_record(record)
        if candidate is None and args.all:
            text = str(record.get("text") or "").strip()
            if text:
                candidate = {
                    "text": text,
                    "allowed_types": [],
                    "forbidden_types": [],
                    "observed_type": str(record.get("route_type") or ""),
                    "observed_args": record.get("route_args") or {},
                    "result_status": record.get("result_status") or "",
                    "feedback_reason": record.get("feedback_reason") or "",
                    "notes": "Review before promoting to regression holdout.",
                }
        if candidate is None:
            continue
        key = candidate["text"].casefold()
        if key in seen:
            continue
        seen.add(key)
        candidates.append(candidate)

    with args.out.open("w", encoding="utf-8") as f:
        for candidate in candidates:
            f.write(json.dumps(candidate, ensure_ascii=False, sort_keys=True) + "\n")

    print(f"records_read={len(records)}")
    print(f"candidates_exported={len(candidates)}")
    print(f"output={args.out}")
    print("Promote reviewed rows into data/nlu/regression_holdout.jsonl before release.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
