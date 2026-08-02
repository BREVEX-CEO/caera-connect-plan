# Two REAL top-level windows with exactly-known text.
#
# The decoy is the point. A screenshot that quietly grabbed the whole screen
# would still contain the target's text and would still "pass" an OCR check —
# so scoping is proven by what must be ABSENT, not only by what is present.
# The decoy sits immediately to the right of the target, close enough that a
# sloppy rect (off-by-a-scale-factor, or the full desktop) sweeps it in.
param(
  [int]$TargetX = 120,
  [int]$TargetY = 120,
  [int]$Width = 760,
  [int]$Height = 420
)
Add-Type -AssemblyName System.Windows.Forms, System.Drawing

function New-TextWindow {
  param($Title, $Lines, $X, $Y, $W, $H, $Back, $Fore)
  $f = New-Object System.Windows.Forms.Form
  $f.Text = $Title
  $f.StartPosition = "Manual"
  $f.Location = New-Object System.Drawing.Point($X, $Y)
  $f.Size = New-Object System.Drawing.Size($W, $H)
  $f.BackColor = $Back
  $f.FormBorderStyle = "FixedSingle"
  $lbl = New-Object System.Windows.Forms.Label
  $lbl.Text = ($Lines -join "`r`n")
  # A plain, high-contrast, generously sized face. OCR accuracy is not what is
  # under test here — scoping and DPI correctness are — so the text is rendered
  # the way a real application renders readable UI text.
  $lbl.Font = New-Object System.Drawing.Font("Segoe UI", 19, [System.Drawing.FontStyle]::Regular)
  $lbl.ForeColor = $Fore
  $lbl.AutoSize = $false
  $lbl.Dock = "Fill"
  $lbl.TextAlign = "MiddleCenter"
  $f.Controls.Add($lbl)
  return $f
}

$targetLines = @(
  "OCADE CAPTURE TARGET",
  "The quick brown fox jumps over the lazy dog",
  "Invoice 48213 Total 1204.55"
)
$decoyLines = @(
  "DECOY WINDOW",
  "MUST NOT APPEAR IN A SCOPED CAPTURE"
)

$target = New-TextWindow -Title "OCADE-CAPTURE-TARGET" -Lines $targetLines `
  -X $TargetX -Y $TargetY -W $Width -H $Height `
  -Back ([System.Drawing.Color]::White) -Fore ([System.Drawing.Color]::Black)

$decoy = New-TextWindow -Title "OCADE-DECOY" -Lines $decoyLines `
  -X ($TargetX + $Width + 10) -Y $TargetY -W 560 -H $Height `
  -Back ([System.Drawing.Color]::Black) -Fore ([System.Drawing.Color]::White)

$decoy.Show()
$target.Show()
$target.Activate()

# Publish both handles so the capture step targets a specific HWND rather than
# guessing from a title, which is what a real host would be given.
$out = @{
  targetHwnd = [int64]$target.Handle
  decoyHwnd  = [int64]$decoy.Handle
  targetTitle = $target.Text
  decoyTitle = $decoy.Text
  targetLines = $targetLines
  decoyLines = $decoyLines
} | ConvertTo-Json -Compress
Set-Content -Path (Join-Path $env:TEMP "ocade-test-windows.json") -Value $out -Encoding utf8

[System.Windows.Forms.Application]::Run()
