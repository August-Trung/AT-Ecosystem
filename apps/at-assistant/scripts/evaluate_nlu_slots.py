from __future__ import annotations

import argparse
from datetime import datetime
import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.core.router import route


def _load_cases(path: Path) -> list[dict[str, object]]:
    cases: list[dict[str, object]] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                cases.append(json.loads(line))
    return cases


def _parse_iso(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _matches(case: dict[str, object]) -> list[str]:
    errors: list[str] = []
    decision = route(str(case.get("text") or ""))
    expected_type = str(case.get("type") or "")
    if decision.type.value != expected_type:
        errors.append(f"type expected={expected_type} actual={decision.type.value}")
        return errors

    expected_args = case.get("args") or {}
    if isinstance(expected_args, dict):
        for key, expected_value in expected_args.items():
            actual_value = decision.args.get(str(key))
            if actual_value != expected_value:
                errors.append(f"args.{key} expected={expected_value!r} actual={actual_value!r}")

    due = case.get("due") or {}
    if isinstance(due, dict):
        due_at = str(decision.args.get("due_at") or "")
        parsed_due = _parse_iso(due_at)
        if due.get("present") and not parsed_due:
            errors.append("due_at missing")
        if "hour" in due:
            if not parsed_due:
                errors.append("due_at missing")
            elif parsed_due.hour != int(due["hour"]):
                errors.append(f"due.hour expected={due['hour']} actual={parsed_due.hour}")
        if "minute" in due:
            if not parsed_due:
                errors.append("due_at missing")
            elif parsed_due.minute != int(due["minute"]):
                errors.append(f"due.minute expected={due['minute']} actual={parsed_due.minute}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate route intent slots against a JSONL holdout set.")
    parser.add_argument("--data", type=Path, default=ROOT / "data" / "nlu" / "slot_holdout.jsonl")
    args = parser.parse_args()

    cases = _load_cases(args.data)
    failed = 0
    for idx, case in enumerate(cases, start=1):
        errors = _matches(case)
        if errors:
            failed += 1
            print(f"FAIL {idx}: {case.get('text')}")
            for error in errors:
                print(f"  - {error}")
    passed = len(cases) - failed
    print(f"slot_cases={len(cases)}")
    print(f"slot_passed={passed}")
    print(f"slot_failed={failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
