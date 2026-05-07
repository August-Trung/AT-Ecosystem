param(
    [string]$ServerInstance,
    [string]$Database = "db_MyFileHub",
    [string]$OutputDirectory = ".\\Backups"
)

$ErrorActionPreference = "Stop"

if (-not $ServerInstance) {
    throw "ServerInstance is required."
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$outputRoot = Join-Path $projectRoot $OutputDirectory
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $outputRoot "$Database-$timestamp.bak"
$sqlBackupPath = $backupPath.Replace("\", "\\")

$query = "BACKUP DATABASE [$Database] TO DISK = N'$sqlBackupPath' WITH INIT, COMPRESSION, CHECKSUM;"
sqlcmd -S $ServerInstance -d master -E -Q $query

Write-Host "Backup created at $backupPath"
