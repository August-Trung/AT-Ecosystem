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


def _case_errors(case: dict[str, object]) -> list[str]:
    decision = route(str(case.get("text") or ""))
    actual_type = decision.type.value
    errors: list[str] = []

    forbidden = set(str(item) for item in case.get("forbidden_types") or [])
    if actual_type in forbidden:
        errors.append(f"forbidden type actual={actual_type}")

    allowed = set(str(item) for item in case.get("allowed_types") or [])
    if allowed and actual_type not in allowed:
        errors.append(f"type allowed={sorted(allowed)} actual={actual_type}")

    expected_args = case.get("args") or {}
    if isinstance(expected_args, dict) and actual_type in allowed:
        for key, expected in expected_args.items():
            actual = decision.args.get(str(key))
            if actual != expected:
                errors.append(f"args.{key} expected={expected!r} actual={actual!r}")

    contains_args = case.get("args_contains") or {}
    if isinstance(contains_args, dict) and actual_type in allowed:
        for key, expected_part in contains_args.items():
            actual = str(decision.args.get(str(key)) or "")
            if str(expected_part) not in actual:
                errors.append(f"args.{key} expected_contains={expected_part!r} actual={actual!r}")

    due = case.get("due") or {}
    if isinstance(due, dict) and actual_type in allowed:
        due_at = str(decision.args.get("due_at") or "")
        parsed_due = _parse_iso(due_at)
        if due.get("present") and not parsed_due:
            errors.append("due_at missing")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Run stress tests for NLU routing and safety.")
    parser.add_argument("--data", type=Path, default=ROOT / "data" / "nlu" / "stress_holdout.jsonl")
    parser.add_argument("--suite-name", default="stress")
    args = parser.parse_args()

    cases = _load_cases(args.data)
    failed = 0
    risky_cases = 0
    ambiguous_cases = 0
    for idx, case in enumerate(cases, start=1):
        if case.get("risky"):
            risky_cases += 1
        if case.get("ambiguous"):
            ambiguous_cases += 1
        errors = _case_errors(case)
        if errors:
            failed += 1
            text = str(case.get("text") or "")
            print(f"FAIL {idx}: {text.encode('unicode_escape').decode('ascii')}")
            for error in errors:
                print(f"  - {error.encode('unicode_escape').decode('ascii')}")
    passed = len(cases) - failed
    prefix = args.suite_name.strip() or "stress"
    print(f"{prefix}_cases={len(cases)}")
    print(f"{prefix}_passed={passed}")
    print(f"{prefix}_failed={failed}")
    print(f"{prefix}_accuracy={passed / max(len(cases), 1):.4f}")
    print(f"risky_cases={risky_cases}")
    print(f"ambiguous_cases={ambiguous_cases}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
