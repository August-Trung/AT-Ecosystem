param(
    [string]$ServerInstance,
    [string]$Database = "db_MyFileHub"
)

$ErrorActionPreference = "Stop"

if (-not $ServerInstance) {
    throw "ServerInstance is required."
}

$migrationRoot = Join-Path (Split-Path -Parent $PSScriptRoot) "Database\\migrations"
$scripts = @(
    "001_create_users_table.sql",
    "002_create_links_table.sql",
    "003_create_files_table.sql",
    "004_create_stored_procedures.sql",
    "005_add_auth_methods.sql"
)

foreach ($script in $scripts) {
    $path = Join-Path $migrationRoot $script
    sqlcmd -S $ServerInstance -d $Database -E -i $path
}
