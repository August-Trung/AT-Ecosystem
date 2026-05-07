# NLU ML Router

ATAssistant now has an optional offline ML intent classifier layer.

Runtime order:

1. Existing rule-first router handles high-confidence commands.
2. If no rule matches, the ML classifier can map natural text to an intent.
3. If model confidence is below threshold, routing falls back to the existing chat/web/LLM path.

The first baseline uses `scikit-learn` with character n-gram TF-IDF and Logistic Regression.

## Files

- Dataset seed: `data/nlu/intent_seed.csv`
- Holdout set: `data/nlu/intent_holdout.csv`
- Runtime predictor: `src/core/nlu_ml.py`
- Train script: `scripts/train_nlu_intent.py`
- Evaluate script: `scripts/evaluate_nlu_intent.py`
- Model output: `models/nlu/intent_classifier.joblib`

## Train

```powershell
python scripts/train_nlu_intent.py
```

## Evaluate

```powershell
python scripts/evaluate_nlu_intent.py
python scripts/evaluate_nlu_intent.py --holdout data\nlu\intent_holdout.csv
python scripts/evaluate_nlu_slots.py
```

## Feedback Loop

Runtime feedback is written to `app_settings/nlu_feedback.jsonl`.

Export records that need review:

```powershell
python scripts/export_nlu_feedback.py
```

Fill `correct_intent` in `app_settings/nlu_feedback_review.csv`, then merge reviewed rows into the seed dataset:

```powershell
python scripts/merge_nlu_feedback.py
python scripts/train_nlu_intent.py
python scripts/evaluate_nlu_intent.py --holdout data\nlu\intent_holdout.csv
python scripts/evaluate_nlu_slots.py
```

Safe auto-labeling is available for production feedback. It only accepts successful, non-risky, high-confidence records:

```powershell
python scripts/auto_label_nlu_feedback.py
```

Run the complete safe loop: auto-label, merge new safe examples, train, evaluate, and promote only if verification passes:

```powershell
python scripts/auto_train_nlu.py
```

Risky intents such as deleting files, moving files, sending email, replying email, deleting reminders, and closing apps are rejected from auto-labeling.

## Notes

The runtime normalizes Vietnamese text to lowercase ASCII before prediction so the model can handle both accented and unaccented user input.

Risky intents use higher confidence thresholds. For example, delete, move, close-app, and send-email intents must be more confident than low-risk lookup intents.

The seed and holdout datasets are still synthetic. Production quality depends on collecting real user utterances, labeling them, and adding regression tests for failed commands.
