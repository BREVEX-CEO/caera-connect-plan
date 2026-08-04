# Probe the prerequisites Section K depends on, and report what is actually here.
#
# This exists so "blocked" is a measurement rather than a claim. Every entry
# records what was looked for, whether it was found, and where — so the owner
# can see exactly what would unblock each item instead of taking my word for it.
$ErrorActionPreference = "Continue"

function Probe($name, $requiredFor, $block) {
  $found = $false; $detail = ""
  try { $detail = (& $block); if ($detail) { $found = $true } }
  catch { $detail = $_.Exception.Message }
  [pscustomobject]@{
    name = $name
    requiredFor = $requiredFor
    present = $found
    detail = ("" + $detail).Trim()
  }
}

$probes = @(
  Probe "ANDROID_HOME / ANDROID_SDK_ROOT" "K1 Android build" {
    if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { $null }
  }
  Probe "Android SDK at default location" "K1 Android build" {
    $p = Join-Path $env:LOCALAPPDATA "Android\Sdk"
    if (Test-Path $p) { $p } else { $null }
  }
  Probe "adb" "K1 install/launch on emulator" {
    $c = Get-Command adb -ErrorAction SilentlyContinue; if ($c) { $c.Source } else { $null }
  }
  Probe "emulator" "K1 Android emulator" {
    $c = Get-Command emulator -ErrorAction SilentlyContinue; if ($c) { $c.Source } else { $null }
  }
  Probe "JDK (java)" "K1 gradle build" {
    $c = Get-Command java -ErrorAction SilentlyContinue; if ($c) { $c.Source } else { $null }
  }
  Probe "Gradle wrapper" "K1 Android build" {
    if (Test-Path "android\gradlew.bat") { (Resolve-Path "android\gradlew.bat").Path } else { $null }
  }
  Probe "Android manifest" "K1 Android build" {
    $m = "android\app\src\main\AndroidManifest.xml"
    if (Test-Path $m) { (Resolve-Path $m).Path } else { $null }
  }
  Probe "Xcode project" "K1 iOS build" {
    $x = Get-ChildItem -Path "ios" -Filter "*.xcodeproj" -Recurse -Depth 3 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($x) { $x.FullName } else { $null }
  }
  Probe "GitHub CLI authenticated" "K1 iOS via cloud macOS CI" {
    $gh = "C:\Program Files\GitHub CLI\gh.exe"
    if (-not (Test-Path $gh)) { return $null }
    $out = & $gh auth status 2>&1 | Out-String
    if ($out -match "Logged in to") { $out.Trim() } else { $null }
  }
  Probe "Any connected mobile device" "K2, K3, K4" {
    $c = Get-Command adb -ErrorAction SilentlyContinue
    if (-not $c) { return $null }
    $out = & adb devices 2>&1 | Out-String
    if ($out -match "\bdevice\b") { $out.Trim() } else { $null }
  }
)

@{
  schemaVersion = 1
  generatedAt = (Get-Date).ToString("o")
  probes = @($probes)
  presentCount = @($probes | Where-Object { $_.present }).Count
  totalCount = $probes.Count
} | ConvertTo-Json -Depth 6
