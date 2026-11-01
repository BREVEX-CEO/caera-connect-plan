# Installer lifecycle on a disposable Windows runner (plan.md 122, 187): install, run the
# installed companion's own diagnosis, repair by installing again, uninstall - and the
# person's JARVIS folder and files survive. Never run on a customer's or developer's PC.
param([Parameter(Mandatory)] [string] $Installer)
$ErrorActionPreference = "Stop"
$app = Join-Path $env:LOCALAPPDATA "Programs\OCADE JARVIS"
$docs = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "OCADE JARVIS"
$run = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
function Check($ok, $what) { if (-not $ok) { throw "FAILED: $what" }; Write-Output "PASS: $what" }
function Install { Start-Process $Installer -ArgumentList "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART" -WindowStyle Hidden -Wait }

Install
Check (Test-Path (Join-Path $app "ocade-agent.exe")) "companion installed per user, no administrator rights"
Check (Test-Path $docs) "the JARVIS folder exists in Documents"
Check ((Get-ItemProperty $run)."OCADE JARVIS" -like "*ocade-agent-bg.exe*run*") "starts at this user's sign-in"
$menu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\OCADE JARVIS"
Check (@(Get-ChildItem $menu -Filter *.lnk).Count -ge 3) "Start Menu: pair, start and stop shortcuts"
$diagnosis = & (Join-Path $app "ocade-agent.exe") diagnose --workspace $docs 2>&1 | Out-String
Write-Output $diagnosis
Check ($diagnosis -match "OK\s+worker:office_worker") "the installed companion starts its own workers"

$testPython = Join-Path $PSScriptRoot "..\.build-venv\Scripts\python.exe"
$checker = Join-Path $PSScriptRoot "check_frozen.py"
$smoke = & $testPython $checker (Join-Path $app "ocade-agent.exe") 2>&1 | Out-String
Write-Output $smoke
Check (($LASTEXITCODE -eq 0) -and ($smoke -match '"bundledBrowserFixture": true')) "the installed bundled browser reads a real isolated fixture"


Set-Content -Path (Join-Path $docs "my-notes.txt") -Value "keep me"
Install  # repair / reinstall over itself
Check (Test-Path (Join-Path $app "ocade-agent.exe")) "a second install repairs in place"
Check ((Get-Content (Join-Path $docs "my-notes.txt")) -eq "keep me") "reinstall leaves the person's files alone"

$uninstaller = Get-ChildItem $app -Filter "unins*.exe" | Select-Object -First 1
Start-Process $uninstaller.FullName -ArgumentList "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART" -Wait
Start-Sleep -Seconds 3
Check (-not (Test-Path (Join-Path $app "ocade-agent.exe"))) "uninstall removes the companion"
Check ($null -eq (Get-ItemProperty $run -ErrorAction SilentlyContinue)."OCADE JARVIS") "uninstall removes the sign-in start"
Check ((Get-Content (Join-Path $docs "my-notes.txt")) -eq "keep me") "uninstall keeps the person's JARVIS folder and files"

# Every check above throws on failure; the expected non-zero exit of the unpaired diagnose is not the result.
exit 0
