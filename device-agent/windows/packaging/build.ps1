# Builds the companion installer on Windows from pinned requirements (plan.md §26, P04).
# Signing happens only when the owner supplies a code-signing certificate thumbprint in
# OCADE_SIGN_THUMBPRINT; an unsigned build is for disposable test machines only.
# STATUS: CODED, UNTESTED.
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot)
python -m venv .build-venv
.\.build-venv\Scripts\python -m pip install -r requirements.txt pyinstaller==6.22.3
.\.build-venv\Scripts\python -m playwright install chromium
Set-Location packaging
..\.build-venv\Scripts\pyinstaller --noconfirm --distpath ..\dist --workpath ..\build ocade-agent.spec
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
