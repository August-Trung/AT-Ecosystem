from __future__ import annotations

import argparse
import csv
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def read_dataset(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as f:
        return [
            {"text": str(row.get("text") or "").strip(), "intent": str(row.get("intent") or "").strip()}
            for row in csv.DictReader(f)
            if str(row.get("text") or "").strip() and str(row.get("intent") or "").strip()
        ]


def main() -> int:
    parser = argparse.ArgumentParser(description="Merge reviewed NLU feedback CSV into the training dataset.")
    parser.add_argument("--review", type=Path, default=ROOT / "app_settings" / "nlu_feedback_review.csv")
    parser.add_argument("--dataset", type=Path, default=ROOT / "data" / "nlu" / "intent_seed.csv")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    dataset_rows = read_dataset(args.dataset)
    existing = {(row["text"].lower(), row["intent"]) for row in dataset_rows}
    additions: list[dict[str, str]] = []

    if not args.review.exists():
        print(f"review_missing={args.review}")
        print(f"existing_examples={len(dataset_rows)}")
        print("new_examples=0")
        print(f"dataset={args.dataset}")
        print(f"dry_run={args.dry_run}")
        return 0

    with args.review.open("r", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            text = str(row.get("text") or "").strip()
            intent = str(row.get("correct_intent") or "").strip()
            if not text or not intent:
                continue
            key = (text.lower(), intent)
            if key in existing:
                continue
            existing.add(key)
            additions.append({"text": text, "intent": intent})

    if not args.dry_run and additions:
        args.dataset.parent.mkdir(parents=True, exist_ok=True)
        with args.dataset.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["text", "intent"])
            writer.writeheader()
            writer.writerows(dataset_rows + additions)

    print(f"existing_examples={len(dataset_rows)}")
    print(f"new_examples={len(additions)}")
    print(f"dataset={args.dataset}")
    print(f"dry_run={args.dry_run}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
