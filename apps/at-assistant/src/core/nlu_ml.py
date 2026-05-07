from __future__ import annotations

from dataclasses import dataclass
import csv
from functools import lru_cache
from pathlib import Path
from typing import Any
import unicodedata

from src.core.app_paths import resource_path, source_project_root


MODEL_RELATIVE_PATH = Path("models") / "nlu" / "intent_classifier.joblib"
DATASET_RELATIVE_PATH = Path("data") / "nlu" / "intent_seed.csv"


@dataclass(frozen=True)
class NluPrediction:
    intent: str
    confidence: float
    scores: dict[str, float]


class NluModelUnavailable(RuntimeError):
    pass


def dataset_path() -> Path:
    return resource_path(*DATASET_RELATIVE_PATH.parts, prefer_runtime=False)


def model_path() -> Path:
    return resource_path(*MODEL_RELATIVE_PATH.parts, prefer_runtime=False)


def load_dataset(path: Path | None = None) -> list[dict[str, str]]:
    csv_path = path or dataset_path()
    rows: list[dict[str, str]] = []
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            text = str(row.get("text") or "").strip()
            intent = str(row.get("intent") or "").strip()
            if text and intent:
                rows.append({"text": text, "intent": intent})
    return rows


def normalize_nlu_text(text: str) -> str:
    value = unicodedata.normalize("NFD", text or "")
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    value = value.replace("đ", "d").replace("Đ", "D")
    return " ".join(value.lower().split())


def train_intent_classifier(rows: list[dict[str, str]]) -> Any:
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import LogisticRegression
        from sklearn.pipeline import Pipeline
    except Exception as exc:  # pragma: no cover - depends on optional local package
        raise NluModelUnavailable("scikit-learn is required to train the NLU classifier.") from exc

    texts = [normalize_nlu_text(row["text"]) for row in rows]
    labels = [row["intent"] for row in rows]
    if len(set(labels)) < 2:
        raise ValueError("Need at least two intent labels to train the NLU classifier.")

    model = Pipeline(
        steps=[
            (
                "tfidf",
                TfidfVectorizer(
                    analyzer="char_wb",
                    ngram_range=(2, 5),
                    lowercase=True,
                    min_df=1,
                ),
            ),
            (
                "clf",
                LogisticRegression(
                    max_iter=1000,
                    class_weight="balanced",
                    random_state=42,
                ),
            ),
        ]
    )
    model.fit(texts, labels)
    return model


def save_model(model: Any, path: Path | None = None) -> Path:
    try:
        import joblib
    except Exception as exc:  # pragma: no cover - depends on optional local package
        raise NluModelUnavailable("joblib is required to save the NLU classifier.") from exc

    output_path = path or (source_project_root() / MODEL_RELATIVE_PATH)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, output_path)
    return output_path


@lru_cache(maxsize=1)
def _load_default_model() -> Any | None:
    return _load_model_from_path(model_path())


def _load_model_from_path(model_file: Path) -> Any | None:
    if not model_file.exists():
        return None
    try:
        import joblib
    except Exception:
        return None
    try:
        return joblib.load(model_file)
    except Exception:
        return None


def load_model(path: Path | None = None) -> Any | None:
    if path is None:
        return _load_default_model()
    return _load_model_from_path(path)


def predict_intent(text: str, *, model: Any | None = None) -> NluPrediction | None:
    user_text = (text or "").strip()
    if not user_text:
        return None
    loaded_model = model if model is not None else load_model()
    if loaded_model is None:
        return None

    if not hasattr(loaded_model, "predict_proba"):
        normalized_text = normalize_nlu_text(user_text)
        label = str(loaded_model.predict([normalized_text])[0])
        return NluPrediction(intent=label, confidence=1.0, scores={label: 1.0})

    normalized_text = normalize_nlu_text(user_text)
    probabilities = loaded_model.predict_proba([normalized_text])[0]
    classes = [str(label) for label in loaded_model.classes_]
    scores = {label: float(prob) for label, prob in zip(classes, probabilities)}
    intent = max(scores, key=scores.get)
    return NluPrediction(intent=intent, confidence=scores[intent], scores=scores)
