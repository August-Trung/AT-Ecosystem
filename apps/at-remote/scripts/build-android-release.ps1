param(
  [string]$OutputDir = "releases"
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$AndroidDir = Join-Path $Root "android"
$PackagePath = Join-Path $Root "package.json"
$GradlePath = Join-Path $AndroidDir "app\build.gradle"

if (-not $env:JAVA_HOME) {
  $StudioJdk = "C:\Program Files\Android\Android Studio\jbr"
  if (Test-Path $StudioJdk) {
    $env:JAVA_HOME = $StudioJdk
  }
}
if (-not $env:ANDROID_HOME) {
  $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA "Android\Sdk"
}
if (-not $env:ANDROID_SDK_ROOT) {
  $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
}
if ($env:JAVA_HOME) {
  $env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
}

$GradleText = Get-Content $GradlePath -Raw
$VersionNameMatch = [regex]::Match($GradleText, 'versionName\s+"([^"]+)"')
$VersionCodeMatch = [regex]::Match($GradleText, 'versionCode\s+(\d+)')
$Package = Get-Content $PackagePath -Raw | ConvertFrom-Json
$VersionName = if ($VersionNameMatch.Success) { $VersionNameMatch.Groups[1].Value } else { [string]$Package.version }
$VersionCode = if ($VersionCodeMatch.Success) { $VersionCodeMatch.Groups[1].Value } else { "0" }

Push-Location $Root
try {
  npm run android:sync
}
finally {
  Pop-Location
}

Push-Location $AndroidDir
try {
  .\gradlew.bat assembleRelease
}
finally {
  Pop-Location
}

$ApkPath = Join-Path $AndroidDir "app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $ApkPath)) {
  throw "Release APK not found at $ApkPath"
}

$ResolvedOutput = Join-Path $Root $OutputDir
New-Item -ItemType Directory -Path $ResolvedOutput -Force | Out-Null
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$TargetName = "AT-Remote-v$VersionName-$VersionCode-$Stamp.apk"
$TargetPath = Join-Path $ResolvedOutput $TargetName
Copy-Item -LiteralPath $ApkPath -Destination $TargetPath -Force

$Latest = [ordered]@{
  app = "AT Remote"
  versionName = $VersionName
  versionCode = [int]$VersionCode
  builtAt = (Get-Date).ToUniversalTime().ToString("o")
  apk = $TargetName
}
$Latest | ConvertTo-Json | Set-Content -Path (Join-Path $ResolvedOutput "latest.json") -Encoding UTF8

Write-Host "Release APK: $TargetPath"
Write-Host "Metadata:    $(Join-Path $ResolvedOutput 'latest.json')"
