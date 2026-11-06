# Builds the companion installer on Windows from pinned requirements (plan.md §26, P04).
# Signing happens only when the owner supplies a code-signing certificate thumbprint in
# OCADE_SIGN_THUMBPRINT; an unsigned build is for disposable test machines only.
# Windows Server CI qualification is recorded in evidence; consumer/signing gates remain open.
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot)
# Use a package-local Chromium store, never the build user's AppData browser cache.
# This directory is embedded in the frozen release so customers install no browser tools.
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PSScriptRoot "playwright-browsers"
python -m venv .build-venv
.\.build-venv\Scripts\python -m pip install -r requirements.txt pyinstaller==6.22.3
.\.build-venv\Scripts\python -m playwright install --no-shell chromium
Set-Location packaging
..\.build-venv\Scripts\pyinstaller --noconfirm --distpath ..\dist --workpath ..\build ocade-agent.spec
if ($env:SOURCE_DATE_EPOCH) {
  # Reproducible installer: every bundled file carries the commit's time, not the build's.
  $stamp = [DateTimeOffset]::FromUnixTimeSeconds([long]$env:SOURCE_DATE_EPOCH).UtcDateTime
  Get-ChildItem ..\dist -Recurse -File | ForEach-Object { $_.LastWriteTimeUtc = $stamp }
}
if ($env:OCADE_SIGN_THUMBPRINT) {
  Get-ChildItem "..\dist\OCADE JARVIS\*.exe" | ForEach-Object {
    signtool sign /sha1 $env:OCADE_SIGN_THUMBPRINT /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 $_.FullName
  }
} else {
  Write-Warning "UNSIGNED BUILD: for disposable test machines only."
}
iscc ocade-agent.iss
if ($env:OCADE_SIGN_THUMBPRINT) {
  signtool sign /sha1 $env:OCADE_SIGN_THUMBPRINT /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 "Output\OCADE-JARVIS-Setup-0.1.0.exe"
}

if ($env:OCADE_RELEASE_PUBLIC_KEY_FILE -and $env:SOURCE_DATE_EPOCH) {
  ..\.build-venv\Scripts\python check_frozen.py --prepare-update "..\dist\OCADE JARVIS" `
    --archive "Output\OCADE-JARVIS-update.tar.gz" --manifest "Output\OCADE-JARVIS-update.json" `
    --source-epoch $env:SOURCE_DATE_EPOCH
  if ($LASTEXITCODE -ne 0) { throw "Update archive preparation failed" }
}
