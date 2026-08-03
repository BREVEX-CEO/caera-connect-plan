# Verify a real Windows installer WITHOUT installing anything.
#
# "Confirm the installer opens correctly" must not mean "run it and install the
# product onto the operator's machine". An administrative install
# (`msiexec /a ... /qn TARGETDIR=...`) makes Windows Installer genuinely open
# and parse the package and extract its payload to a folder — no services, no
# registry entries, no Start-menu shortcuts, nothing registered. If the package
# were malformed, this is exactly where it would fail.
#
# For the NSIS installer the equivalent is not available, so it is verified
# structurally: it must be a real PE executable carrying the NSIS signature.
# That is stated as what it is rather than dressed up as a launch.
param(
  [Parameter(Mandatory = $true)][string]$MsiPath = "",
  [string]$NsisPath = "",
  [string]$ExtractTo = ""
)
$ErrorActionPreference = "Continue"

function Get-MsiProperty($path, $property) {
  # Read the MSI's own Property table via the Windows Installer COM API. This
  # is the package describing itself, not a filename being parsed.
  try {
    $installer = New-Object -ComObject WindowsInstaller.Installer
    $db = $installer.GetType().InvokeMember("OpenDatabase", "InvokeMethod", $null, $installer, @($path, 0))
    $view = $db.GetType().InvokeMember("OpenView", "InvokeMethod", $null, $db, @("SELECT Value FROM Property WHERE Property='$property'"))
    $view.GetType().InvokeMember("Execute", "InvokeMethod", $null, $view, $null)
    $record = $view.GetType().InvokeMember("Fetch", "InvokeMethod", $null, $view, $null)
    if ($null -eq $record) { return $null }
    return $record.GetType().InvokeMember("StringData", "GetProperty", $null, $record, 1)
  } catch {
    return "ERROR: $($_.Exception.Message)"
  }
}

$result = @{ msi = $null; nsis = $null }

if ($MsiPath -and (Test-Path $MsiPath)) {
  $item = Get-Item $MsiPath
  if (-not $ExtractTo) { $ExtractTo = Join-Path $env:TEMP "ocade-msi-admin-extract" }
  if (Test-Path $ExtractTo) { Remove-Item $ExtractTo -Recurse -Force -ErrorAction SilentlyContinue }
  New-Item -ItemType Directory -Force -Path $ExtractTo | Out-Null
  $log = Join-Path $env:TEMP "ocade-msi-admin.log"

  # /a  = administrative install (extract only)
  # /qn = no UI, so nothing can block waiting for a human
  $proc = Start-Process msiexec.exe -ArgumentList @("/a", "`"$MsiPath`"", "/qn", "TARGETDIR=`"$ExtractTo`"", "/l*v", "`"$log`"") -Wait -PassThru
  $extracted = @(Get-ChildItem -Path $ExtractTo -Recurse -File -ErrorAction SilentlyContinue)
  $logTail = if (Test-Path $log) { (Get-Content $log -Tail 12) -join "`n" } else { "" }

  $result.msi = @{
    path = $item.FullName
    bytes = $item.Length
    sha256 = (Get-FileHash $MsiPath -Algorithm SHA256).Hash.ToLower()
    productName = (Get-MsiProperty $MsiPath "ProductName")
    productVersion = (Get-MsiProperty $MsiPath "ProductVersion")
    manufacturer = (Get-MsiProperty $MsiPath "Manufacturer")
    productCode = (Get-MsiProperty $MsiPath "ProductCode")
    administrativeInstallExitCode = $proc.ExitCode
    # Exit code 0 means Windows Installer opened the package, parsed its
    # tables and wrote out the payload.
    packageOpenedAndExtracted = ($proc.ExitCode -eq 0 -and $extracted.Count -gt 0)
    extractedFileCount = $extracted.Count
    extractedSample = @($extracted | Select-Object -First 8 | ForEach-Object { $_.FullName.Substring($ExtractTo.Length).TrimStart('\') })
    extractTo = $ExtractTo
    logTail = $logTail
    note = "Administrative install: the package is opened and its payload extracted, and NOTHING is installed, registered or written to the system."
  }
}

if ($NsisPath -and (Test-Path $NsisPath)) {
  $item = Get-Item $NsisPath
  $bytes = [System.IO.File]::ReadAllBytes($NsisPath)
  $isPe = $bytes.Length -gt 2 -and $bytes[0] -eq 0x4D -and $bytes[1] -eq 0x5A  # "MZ"
  $ascii = [System.Text.Encoding]::ASCII.GetString($bytes)
  $result.nsis = @{
    path = $item.FullName
    bytes = $item.Length
    sha256 = (Get-FileHash $NsisPath -Algorithm SHA256).Hash.ToLower()
    isPortableExecutable = $isPe
    carriesNsisSignature = ($ascii.Contains("Nullsoft") -or $ascii.Contains("NullsoftInst"))
    versionInfo = (Get-Item $NsisPath).VersionInfo.FileVersion
    note = "Verified structurally. Executing an NSIS installer would begin a real installation on this machine, which is not something to do to prove a package is well-formed."
  }
}

$result | ConvertTo-Json -Depth 6
