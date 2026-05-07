param(
    [string]$ApiRoot = (Split-Path -Parent $PSScriptRoot),
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"

$uploadsPath = Join-Path $ApiRoot "Storage\\Uploads"
if (-not (Test-Path $uploadsPath)) {
    Write-Host "Uploads directory not found. Nothing to clean."
    exit 0
}

$threshold = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem $uploadsPath -File |
    Where-Object { $_.LastWriteTime -lt $threshold } |
    Remove-Item -Force

Write-Host "Removed uploads older than $RetentionDays days from $uploadsPath"
