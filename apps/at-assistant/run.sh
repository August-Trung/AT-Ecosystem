#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"

if [[ -x "$ROOT/.venv/Scripts/python.exe" ]]; then
  PYTHON="$ROOT/.venv/Scripts/python.exe"
else
  PYTHON="python"
fi

COMMAND="${1:-help}"

run_step() {
  local name="$1"
  shift
  echo
  echo "== $name =="
  "$PYTHON" "$@"
}

show_help() {
  cat <<'EOF'
AT Assistant command shortcuts

Usage:
  ./run.sh app       Start the desktop app
  ./run.sh check     Run NLU stress + regression + intent + slot checks
  ./run.sh train     Safe auto-label, train, evaluate, and promote NLU model
  ./run.sh test      Run all pytest tests
  ./run.sh full      Run check, then all pytest tests
  ./run.sh stress    Run only NLU stress suite
  ./run.sh intent    Run only intent holdout evaluation
  ./run.sh slots     Run only slot holdout evaluation
  ./run.sh feedback  Export NLU feedback for review
  ./run.sh regressions Export failed/unclear feedback as regression candidates
EOF
}

invoke_nlu_check() {
  run_step "NLU stress" "scripts/evaluate_nlu_stress.py"
  run_step "NLU regressions" "scripts/evaluate_nlu_stress.py" --data "data/nlu/regression_holdout.jsonl" --suite-name "regression"
  run_step "NLU intent holdout" "scripts/evaluate_nlu_intent.py" --holdout "data/nlu/intent_holdout.csv"
  run_step "NLU slots" "scripts/evaluate_nlu_slots.py"
}

case "${COMMAND,,}" in
  app)
    run_step "Desktop app" -m src.gui.main_gui
    ;;
  check)
    invoke_nlu_check
    ;;
  train)
    run_step "NLU safe auto-train" "scripts/auto_train_nlu.py"
    ;;
  test)
    run_step "Pytest" -m pytest
    ;;
  full)
    invoke_nlu_check
    run_step "Pytest" -m pytest
    ;;
  stress)
    run_step "NLU stress" "scripts/evaluate_nlu_stress.py"
    ;;
  intent)
    run_step "NLU intent holdout" "scripts/evaluate_nlu_intent.py" --holdout "data/nlu/intent_holdout.csv"
    ;;
  slots)
    run_step "NLU slots" "scripts/evaluate_nlu_slots.py"
    ;;
  feedback)
    run_step "Export NLU feedback" "scripts/export_nlu_feedback.py"
    ;;
  regressions)
    run_step "Export NLU regression candidates" "scripts/export_nlu_regression_candidates.py"
    ;;
  help)
    show_help
    ;;
  *)
    echo "Unknown command: $COMMAND"
    echo
    show_help
    exit 2
    ;;
esac
