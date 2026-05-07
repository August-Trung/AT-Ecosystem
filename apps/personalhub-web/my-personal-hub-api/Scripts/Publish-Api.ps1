param(
    [string]$Configuration = "Release",
    [string]$Output = ".\\publish"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot

try {
    dotnet restore
    dotnet publish .\\my-personal-hub-api.csproj -c $Configuration -o $Output
}
finally {
    Pop-Location
}
