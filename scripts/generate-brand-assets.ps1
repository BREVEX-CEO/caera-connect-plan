param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$markPath = Join-Path $Root "public/brand/ocade-carcc-mark.png"
$wordmarkPath = Join-Path $Root "public/brand/ocade-carcc-wordmark.png"
if (-not (Test-Path -LiteralPath $markPath) -or -not (Test-Path -LiteralPath $wordmarkPath)) {
  throw "Canonical CARCC CADANE brand sources are missing."
}

function Save-FittedPng {
  param(
    [string]$Source,
    [string]$Destination,
    [int]$Width,
    [int]$Height,
    [double]$Scale = 1.0
  )

  $directory = Split-Path -Parent $Destination
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $sourceImage = [System.Drawing.Image]::FromFile($Source)
  try {
    $canvas = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($canvas)
      try {
        $graphics.Clear([System.Drawing.Color]::Black)
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

        $fit = [Math]::Min($Width / $sourceImage.Width, $Height / $sourceImage.Height) * $Scale
        $drawWidth = [Math]::Max(1, [int][Math]::Round($sourceImage.Width * $fit))
        $drawHeight = [Math]::Max(1, [int][Math]::Round($sourceImage.Height * $fit))
        $x = [int][Math]::Floor(($Width - $drawWidth) / 2)
        $y = [int][Math]::Floor(($Height - $drawHeight) / 2)
        $graphics.DrawImage($sourceImage, $x, $y, $drawWidth, $drawHeight)
      } finally {
        $graphics.Dispose()
      }
      $canvas.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $canvas.Dispose()
    }
  } finally {
    $sourceImage.Dispose()
  }
}

function Save-PngIco {
  param(
    [string]$Destination,
    [hashtable[]]$Images
  )

  $streams = foreach ($image in $Images) {
    $memory = [System.IO.MemoryStream]::new()
    $bitmap = [System.Drawing.Bitmap]::FromFile($image.Path)
    try {
      $bitmap.Save($memory, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $bitmap.Dispose()
    }
    [pscustomobject]@{ Bytes = $memory.ToArray(); Size = [int]$image.Size }
    $memory.Dispose()
  }

  $file = [System.IO.File]::Open($Destination, [System.IO.FileMode]::Create)
  $writer = [System.IO.BinaryWriter]::new($file)
  try {
    $writer.Write([uint16]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]$streams.Count)
    $offset = 6 + (16 * $streams.Count)
    foreach ($stream in $streams) {
      $dimension = if ($stream.Size -ge 256) { 0 } else { $stream.Size }
      $writer.Write([byte]$dimension)
      $writer.Write([byte]$dimension)
      $writer.Write([byte]0)
      $writer.Write([byte]0)
      $writer.Write([uint16]1)
      $writer.Write([uint16]32)
      $writer.Write([uint32]$stream.Bytes.Length)
      $writer.Write([uint32]$offset)
      $offset += $stream.Bytes.Length
    }
    foreach ($stream in $streams) {
      $writer.Write($stream.Bytes)
    }
  } finally {
    $writer.Dispose()
    $file.Dispose()
  }
}

$publicSizes = 32, 48, 128, 192, 256, 512
foreach ($size in $publicSizes) {
  Save-FittedPng -Source $markPath -Destination (Join-Path $Root "public/icons/ocade-$size.png") -Width $size -Height $size
}
Save-FittedPng -Source $markPath -Destination (Join-Path $Root "public/apple-touch-icon.png") -Width 180 -Height 180

$faviconParts = @()
foreach ($size in 16, 32, 48) {
  $path = Join-Path $Root "public/icons/favicon-$size.png"
  Save-FittedPng -Source $markPath -Destination $path -Width $size -Height $size
  $faviconParts += @{ Path = $path; Size = $size }
}
Save-PngIco -Destination (Join-Path $Root "public/favicon.ico") -Images $faviconParts
foreach ($part in $faviconParts) {
  Remove-Item -LiteralPath $part.Path
}

foreach ($size in 16, 32, 48, 128) {
  Save-FittedPng -Source $markPath -Destination (Join-Path $Root "extension/icons/ocade-$size.png") -Width $size -Height $size
}

Save-FittedPng -Source $markPath -Destination (Join-Path $Root "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png") -Width 1024 -Height 1024

$splashTargets = @(
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png",
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png",
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png"
)
foreach ($relative in $splashTargets) {
  Save-FittedPng -Source $wordmarkPath -Destination (Join-Path $Root $relative) -Width 2732 -Height 2732 -Scale 0.82
}

$androidLauncherSizes = @{
  "mdpi" = 48
  "hdpi" = 72
  "xhdpi" = 96
  "xxhdpi" = 144
  "xxxhdpi" = 192
}
foreach ($density in $androidLauncherSizes.Keys) {
  $size = $androidLauncherSizes[$density]
  foreach ($name in "ic_launcher.png", "ic_launcher_round.png") {
    Save-FittedPng -Source $markPath -Destination (Join-Path $Root "android/app/src/main/res/mipmap-$density/$name") -Width $size -Height $size
  }
  $foregroundSize = [int][Math]::Round($size * 2.25)
  Save-FittedPng -Source $markPath -Destination (Join-Path $Root "android/app/src/main/res/mipmap-$density/ic_launcher_foreground.png") -Width $foregroundSize -Height $foregroundSize -Scale 0.72
}

$androidSplashes = Get-ChildItem -Path (Join-Path $Root "android/app/src/main/res") -Filter "splash.png" -Recurse
foreach ($target in $androidSplashes) {
  $existing = [System.Drawing.Image]::FromFile($target.FullName)
  try {
    $width = $existing.Width
    $height = $existing.Height
  } finally {
    $existing.Dispose()
  }
  Save-FittedPng -Source $wordmarkPath -Destination $target.FullName -Width $width -Height $height -Scale 0.82
}

$nativeIconDir = Join-Path $Root "native/companion/tauri/icons"
Save-FittedPng -Source $markPath -Destination (Join-Path $nativeIconDir "32x32.png") -Width 32 -Height 32
Save-FittedPng -Source $markPath -Destination (Join-Path $nativeIconDir "128x128.png") -Width 128 -Height 128
Save-FittedPng -Source $markPath -Destination (Join-Path $nativeIconDir "128x128@2x.png") -Width 256 -Height 256
Save-FittedPng -Source $markPath -Destination (Join-Path $nativeIconDir "icon.png") -Width 512 -Height 512
Save-FittedPng -Source $markPath -Destination (Join-Path $nativeIconDir "tray.png") -Width 32 -Height 32
$nativeIcoParts = @()
foreach ($size in 16, 32, 48, 256) {
  $path = Join-Path $nativeIconDir "icon-$size.png"
  Save-FittedPng -Source $markPath -Destination $path -Width $size -Height $size
  $nativeIcoParts += @{ Path = $path; Size = $size }
}
Save-PngIco -Destination (Join-Path $nativeIconDir "icon.ico") -Images $nativeIcoParts
foreach ($part in $nativeIcoParts) {
  Remove-Item -LiteralPath $part.Path
}

Write-Output "Generated CARCC CADANE/OCADE assets from the canonical supplied artwork."
