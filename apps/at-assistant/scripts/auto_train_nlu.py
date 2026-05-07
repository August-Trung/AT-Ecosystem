from __future__ import annotations

import argparse
import csv
from pathlib import Path
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.auto_label_nlu_feedback import safe_auto_label
from src.core import nlu_feedback


DATASET = ROOT / "data" / "nlu" / "intent_seed.csv"
AUTO_LABELED = ROOT / "data" / "nlu" / "auto_labeled.csv"
MODEL = ROOT / "models" / "nlu" / "intent_classifier.joblib"
MODEL_BACKUP = ROOT / "models" / "nlu" / "intent_classifier.joblib.bak"


def read_dataset(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as f:
        return [
            {"text": str(row.get("text") or "").strip(), "intent": str(row.get("intent") or "").strip()}
            for row in csv.DictReader(f)
            if str(row.get("text") or "").strip() and str(row.get("intent") or "").strip()
        ]


def write_dataset(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["text", "intent"])
        writer.writeheader()
        writer.writerows(rows)


def collect_safe_feedback(input_path: Path | None = None) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for record in nlu_feedback.read_records(input_path):
        intent, _reason = safe_auto_label(record)
        text = str(record.get("text") or "").strip()
        if not intent or not text:
            continue
        key = (text.lower(), intent)
        if key in seen:
            continue
        seen.add(key)
        rows.append({"text": text, "intent": intent})
    return rows


def run_command(args: list[str]) -> None:
    completed = subprocess.run(args, cwd=ROOT, check=False)
    if completed.returncode != 0:
        raise RuntimeError(f"Command failed with exit={completed.returncode}: {' '.join(args)}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Auto-label safe feedback, merge it, train, evaluate, and promote only on success.")
    parser.add_argument("--input", type=Path, default=None, help="Feedback JSONL path. Defaults to app_settings/nlu_feedback.jsonl.")
    parser.add_argument("--min-new", type=int, default=1)
    parser.add_argument("--skip-tests", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    dataset_rows = read_dataset(DATASET)
    existing = {(row["text"].lower(), row["intent"]) for row in dataset_rows}
    safe_rows = collect_safe_feedback(args.input)
    new_rows = [row for row in safe_rows if (row["text"].lower(), row["intent"]) not in existing]

    AUTO_LABELED.parent.mkdir(parents=True, exist_ok=True)
    with AUTO_LABELED.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["text", "intent"])
        writer.writeheader()
        writer.writerows(new_rows)

    print(f"existing_examples={len(dataset_rows)}")
    print(f"safe_feedback={len(safe_rows)}")
    print(f"new_examples={len(new_rows)}")
    print(f"auto_labeled={AUTO_LABELED}")

    if args.dry_run or len(new_rows) < args.min_new:
        print(f"skipped_train={args.dry_run or len(new_rows) < args.min_new}")
        return 0

    original_dataset = list(dataset_rows)
    original_model_exists = MODEL.exists()
    if original_model_exists:
        MODEL_BACKUP.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(MODEL, MODEL_BACKUP)

    try:
        write_dataset(DATASET, dataset_rows + new_rows)
        run_command([sys.executable, "scripts/train_nlu_intent.py"])
        run_command([sys.executable, "scripts/evaluate_nlu_intent.py", "--holdout", "data/nlu/intent_holdout.csv"])
        run_command([sys.executable, "scripts/evaluate_nlu_slots.py"])
        if not args.skip_tests:
            run_command([sys.executable, "-m", "pytest", "tests/test_nlu_feedback.py", "tests/test_nlu_ml_router.py", "tests/test_nlu_slots.py"])
    except Exception:
        write_dataset(DATASET, original_dataset)
        if original_model_exists:
            shutil.copy2(MODEL_BACKUP, MODEL)
        raise
    finally:
        if MODEL_BACKUP.exists():
            MODEL_BACKUP.unlink()

    print("promoted_model=true")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
