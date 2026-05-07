# Lenh Chay Nhanh

Neu quen lenh, chi can mo PowerShell tai thu muc project va chay:

```powershell
.\run.bat help
```

Neu dung Git Bash:

```bash
./run.sh help
```

## Lenh Hay Dung

```powershell
.\run.bat app
```

Git Bash:

```bash
./run.sh app
```

Mo giao dien desktop cua AT Assistant.

```powershell
.\run.bat check
```

Git Bash:

```bash
./run.sh check
```

Kiem tra rieng NLU: stress test, intent holdout, va slot holdout.
Lenh nay cung chay regression holdout cho cac loi that da tung gap.

```powershell
.\run.bat train
```

Git Bash:

```bash
./run.sh train
```

Chay vong NLU production: auto-label an toan, merge dataset, train, evaluate, test, va rollback neu fail.

```powershell
.\run.bat test
```

Git Bash:

```bash
./run.sh test
```

Chay toan bo pytest.

```powershell
.\run.bat full
```

Git Bash:

```bash
./run.sh full
```

Chay `check` roi chay toan bo pytest.

## Lenh NLU Le

```powershell
.\run.bat stress
.\run.bat intent
.\run.bat slots
.\run.bat feedback
.\run.bat regressions
```

`feedback` se export log NLU ra file review de xem cac cau nguoi dung that can bo sung vao dataset.
`regressions` se gom cac cau fallback/loi/khong ro tu feedback thanh candidate de promote vao `data/nlu/regression_holdout.jsonl`.
