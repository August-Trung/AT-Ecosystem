[CmdletBinding()]
param(
    [string]$Command = "app"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
$env:PYTHONPATH = if ($env:PYTHONPATH) { "$Root;$env:PYTHONPATH" } else { $Root }

$Python = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    $Python = "python"
}

function Run-Step {
    param(
        [string]$Name,
        [string[]]$PythonArgs
    )

    Write-Host ""
    Write-Host "== $Name =="
    & $Python @PythonArgs
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

function Show-Help {
    Write-Host "AT Assistant command shortcuts"
    Write-Host ""
    Write-Host "Usage:"
    Write-Host "  .\run.ps1           Start the desktop app"
    Write-Host "  .\run.ps1 app       Start the desktop app"
    Write-Host "  .\run.ps1 remote    Developer only: start AT Remote LAN bridge without the desktop window"
    Write-Host "  .\run.ps1 check     Run NLU stress + regression + intent + slot checks"
    Write-Host "  .\run.ps1 train     Safe auto-label, train, evaluate, and promote NLU model"
    Write-Host "  .\run.ps1 test      Run all pytest tests"
    Write-Host "  .\run.ps1 full      Run check, then all pytest tests"
    Write-Host "  .\run.ps1 stress    Run only NLU stress suite"
    Write-Host "  .\run.ps1 intent    Run only intent holdout evaluation"
    Write-Host "  .\run.ps1 slots     Run only slot holdout evaluation"
    Write-Host "  .\run.ps1 feedback  Export NLU feedback for review"
    Write-Host "  .\run.ps1 regressions Export failed/unclear feedback as regression candidates"
    Write-Host ""
    Write-Host "If PowerShell blocks scripts, use:"
    Write-Host "  .\run.bat check"
}

function Invoke-NluCheck {
    Run-Step "NLU stress" @("scripts\evaluate_nlu_stress.py")
    Run-Step "NLU regressions" @("scripts\evaluate_nlu_stress.py", "--data", "data\nlu\regression_holdout.jsonl", "--suite-name", "regression")
    Run-Step "NLU intent holdout" @("scripts\evaluate_nlu_intent.py", "--holdout", "data\nlu\intent_holdout.csv")
    Run-Step "NLU slots" @("scripts\evaluate_nlu_slots.py")
}

switch ($Command.ToLowerInvariant()) {
    "app" {
        Run-Step "Desktop app" @("-m", "src.gui.main_gui")
    }
    "remote" {
        Run-Step "AT Remote LAN bridge" @("-m", "src.cli.remote_server")
    }
    "check" {
        Invoke-NluCheck
    }
    "train" {
        Run-Step "NLU safe auto-train" @("scripts\auto_train_nlu.py")
    }
    "test" {
        Run-Step "Pytest" @("-m", "pytest")
    }
    "full" {
        Invoke-NluCheck
        Run-Step "Pytest" @("-m", "pytest")
    }
    "stress" {
        Run-Step "NLU stress" @("scripts\evaluate_nlu_stress.py")
    }
    "intent" {
        Run-Step "NLU intent holdout" @("scripts\evaluate_nlu_intent.py", "--holdout", "data\nlu\intent_holdout.csv")
    }
    "slots" {
        Run-Step "NLU slots" @("scripts\evaluate_nlu_slots.py")
    }
    "feedback" {
        Run-Step "Export NLU feedback" @("scripts\export_nlu_feedback.py")
    }
    "regressions" {
        Run-Step "Export NLU regression candidates" @("scripts\export_nlu_regression_candidates.py")
    }
    "help" {
        Show-Help
    }
    default {
        Write-Host "Unknown command: $Command"
        Write-Host ""
        Show-Help
        exit 2
    }
}
