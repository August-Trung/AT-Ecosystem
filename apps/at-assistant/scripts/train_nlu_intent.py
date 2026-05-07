from __future__ import annotations

import argparse
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.core.nlu_ml import load_dataset, save_model, train_intent_classifier


def main() -> int:
    parser = argparse.ArgumentParser(description="Train ATAssistant offline NLU intent classifier.")
    parser.add_argument("--data", type=Path, default=ROOT / "data" / "nlu" / "intent_seed.csv")
    parser.add_argument("--out", type=Path, default=ROOT / "models" / "nlu" / "intent_classifier.joblib")
    args = parser.parse_args()

    rows = load_dataset(args.data)
    model = train_intent_classifier(rows)
    output_path = save_model(model, args.out)
    labels = sorted({row["intent"] for row in rows})
    print(f"trained_examples={len(rows)}")
    print(f"labels={len(labels)}")
    print(f"model={output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
