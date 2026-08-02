# Rasterise a Set-of-Mark overlay onto a real screenshot.
#
# The markers come from `fusePerceptionFrame` in src/lib/control/perception.ts —
# the same list that function turns into `overlaySvg`. Nothing here decides what
# to mark or what to number it; this only draws what the fusion already decided,
# so the picture a model looks at and the plan the executor resolves against
# cannot disagree.
#
# Marker bounds are SCREEN-PHYSICAL. The screenshot is in the target window's
# own render space, so each rectangle is translated by the window origin and
# divided by renderScale — the value the capture host reports for exactly this
# purpose. Getting that wrong would put every box in the wrong place on a scaled
# display, which is the failure this conversion exists to prevent.
param(
  [Parameter(Mandatory = $true)][string]$ImagePath,
  [Parameter(Mandatory = $true)][string]$OutPath,
  [Parameter(Mandatory = $true)][string]$PlanPath
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$plan = Get-Content $PlanPath -Raw -Encoding UTF8 | ConvertFrom-Json
$originX = [double]$plan.originX
$originY = [double]$plan.originY
$scale = [double]$plan.renderScale
if ($scale -le 0) { $scale = 1 }

$src = [System.Drawing.Image]::FromFile($ImagePath)
$bmp = New-Object System.Drawing.Bitmap($src.Width, $src.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($src, 0, 0, $src.Width, $src.Height)
$src.Dispose()
$g.SmoothingMode = "AntiAlias"
$g.TextRenderingHint = "ClearTypeGridFit"

$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 255, 59, 48)), 3
$badgeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 59, 48))
$textBrush = [System.Drawing.Brushes]::White
$font = New-Object System.Drawing.Font("Segoe UI", 13, [System.Drawing.FontStyle]::Bold)
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = "Center"
$fmt.LineAlignment = "Center"

$drawn = 0
foreach ($m in $plan.markers) {
  $x = ($m.boundsPhysical.x - $originX) / $scale
  $y = ($m.boundsPhysical.y - $originY) / $scale
  $w = $m.boundsPhysical.width / $scale
  $h = $m.boundsPhysical.height / $scale
  $g.DrawRectangle($pen, [float]$x, [float]$y, [float]$w, [float]$h)

  # Badge in the top-left corner of the element, nudged inside the image so a
  # mark on a control at the very edge is still legible.
  $r = 15.0
  $cx = [Math]::Max($r + 1, $x + $r)
  $cy = [Math]::Max($r + 1, $y + $r)
  $g.FillEllipse($badgeBrush, [float]($cx - $r), [float]($cy - $r), [float]($r * 2), [float]($r * 2))
  $rect = New-Object System.Drawing.RectangleF ([float]($cx - $r)), ([float]($cy - $r)), ([float]($r * 2)), ([float]($r * 2))
  $g.DrawString([string]$m.number, $font, $textBrush, $rect, $fmt)
  $drawn++
}

$g.Dispose()
$bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$dims = @{ width = $bmp.Width; height = $bmp.Height }
$bmp.Dispose()

@{
  ok = $true; out = $OutPath; drawn = $drawn; image = $dims
  sha256 = (Get-FileHash -Path $OutPath -Algorithm SHA256).Hash.ToLower()
} | ConvertTo-Json -Compress
