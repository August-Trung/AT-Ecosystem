from __future__ import annotations

import argparse
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.core.nlu_ml import load_dataset, normalize_nlu_text, train_intent_classifier


def main() -> int:
    try:
        from sklearn.metrics import classification_report, confusion_matrix
        from sklearn.model_selection import train_test_split
    except Exception as exc:
        raise SystemExit("scikit-learn is required to evaluate the NLU classifier.") from exc

    parser = argparse.ArgumentParser(description="Evaluate ATAssistant offline NLU intent classifier.")
    parser.add_argument("--data", type=Path, default=ROOT / "data" / "nlu" / "intent_seed.csv")
    parser.add_argument("--holdout", type=Path, default=None)
    parser.add_argument("--test-size", type=float, default=0.25)
    args = parser.parse_args()

    rows = load_dataset(args.data)
    if args.holdout:
        holdout_rows = load_dataset(args.holdout)
        train_texts = [row["text"] for row in rows]
        train_labels = [row["intent"] for row in rows]
        test_texts = [normalize_nlu_text(row["text"]) for row in holdout_rows]
        test_labels = [row["intent"] for row in holdout_rows]
        model = train_intent_classifier(rows)
    else:
        texts = [normalize_nlu_text(row["text"]) for row in rows]
        labels = [row["intent"] for row in rows]
        train_texts, test_texts, train_labels, test_labels = train_test_split(
            texts,
            labels,
            test_size=args.test_size,
            random_state=42,
            stratify=labels,
        )
        model = train_intent_classifier(
            [{"text": text, "intent": intent} for text, intent in zip(train_texts, train_labels)]
        )
    predicted = model.predict(test_texts)
    accuracy = sum(1 for expected, actual in zip(test_labels, predicted) if expected == actual) / max(len(test_labels), 1)
    print(f"accuracy={accuracy:.4f}")
    print(f"train_examples={len(train_texts)}")
    print(f"test_examples={len(test_texts)}")
    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(test_texts)
        classes = [str(label) for label in model.classes_]
        print("confidence_coverage:")
        for threshold in [0.5, 0.6, 0.7, 0.8, 0.82, 0.9]:
            accepted = 0
            correct = 0
            for expected, probs in zip(test_labels, probabilities):
                scores = {label: float(prob) for label, prob in zip(classes, probs)}
                intent = max(scores, key=scores.get)
                confidence = scores[intent]
                if confidence >= threshold:
                    accepted += 1
                    if intent == expected:
                        correct += 1
            precision = correct / accepted if accepted else 0.0
            coverage = accepted / max(len(test_labels), 1)
            print(f"  threshold={threshold:.2f} coverage={coverage:.2%} accepted_precision={precision:.2%}")
    print(classification_report(test_labels, predicted, zero_division=0))
    print("labels=" + ",".join(model.classes_))
    print(confusion_matrix(test_labels, predicted, labels=model.classes_))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
