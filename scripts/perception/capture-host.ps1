# OCADE capture + OCR host (Windows).
#
# `src/lib/control/perception.ts` states it "has no OS authority. It accepts
# bounded observations from an approved capture/UIA/OCR/icon/vision host." This
# IS that host, for Windows. It is deliberately the only place with screen
# authority, it captures ONE window by handle, and it never captures the
# desktop.
#
# THREE THINGS THAT ARE EASY TO GET WRONG, AND ARE HANDLED HERE
# -------------------------------------------------------------
# 1. DPI. A process that does not declare per-monitor awareness is lied to by
#    Windows: GetWindowRect returns virtualised logical pixels and the captured
#    bitmap comes back blurry and the wrong size on a scaled display. The host
#    declares PER_MONITOR_AWARE_V2 before touching any window API, so every
#    coordinate below is real device pixels.
#
# 2. GetWindowRect is NOT the visible bounds. Since Windows 10 it includes the
#    invisible DWM resize border — typically 7px per side — so a capture built
#    from it is offset and picks up whatever is behind those edges. The visible
#    frame comes from DWMWA_EXTENDED_FRAME_BOUNDS instead.
#
# 3. Screen-scraping the desktop and cropping is not scoping. PrintWindow asks
#    the window to render ITSELF, so an overlapping window cannot bleed in.
#    PW_RENDERFULLCONTENT is required or DirectComposition surfaces come back
#    blank.
param(
  [Parameter(Mandatory = $true)][ValidateSet("capture", "ocr", "dpi")] [string]$Mode,
  [int64]$Hwnd = 0,
  [string]$Path = "",
  [switch]$DpiUnaware,
  # Reproduces the ORIGINAL defect on purpose: size the canvas from the
  # on-screen rectangle instead of the window's render size. Exists so the
  # unpainted-area detector can be shown to catch a real regression rather than
  # being trusted because it currently reports a small number.
  [switch]$NaiveSize
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing, System.Windows.Forms

$sig = @'
using System;
using System.Runtime.InteropServices;
public class OcadeCap {
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr v);
  // Per-THREAD awareness, which unlike the process-level call can be changed
  // after the fact. It is the only way to demonstrate the unaware failure mode
  // from inside powershell.exe, whose manifest has already declared awareness
  // for the process — which is why merely skipping the process call changed
  // nothing and made the control useless.
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr v);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr h, uint f);
  [DllImport("Shcore.dll")] public static extern int GetDpiForMonitor(IntPtr h, int type, out uint x, out uint y);
  // StringBuilder, not char[]: marshalling a PowerShell char[] here returned the
  // title with a null between every character ("O\0C\0A\0D\0E\0"), because the
  // buffer was being filled as raw UTF-16 bytes and read back as chars.
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT r, int s);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
'@
Add-Type -TypeDefinition $sig

# PER_MONITOR_AWARE_V2 = -4, UNAWARE = -1. Set before any window geometry is
# read. The -DpiUnaware switch exists so the failure mode can be DEMONSTRATED
# rather than merely claimed: the same capture run unaware is measurably wrong
# on a scaled display.
#
# The process-level result is captured rather than discarded. It legitimately
# fails when awareness came from the host process's manifest, and a silently
# swallowed failure there would have meant reporting an awareness this host
# never actually had.
$ctx = if ($DpiUnaware) { [IntPtr](-1) } else { [IntPtr](-4) }
$processAwarenessSet = [OcadeCap]::SetProcessDpiAwarenessContext($ctx)
$threadAwarenessPrev = [OcadeCap]::SetThreadDpiAwarenessContext($ctx)
$threadAwarenessSet = ($threadAwarenessPrev -ne [IntPtr]::Zero)

function Get-WindowInfo([int64]$h) {
  $ptr = [IntPtr]$h
  if (-not [OcadeCap]::IsWindow($ptr)) { throw "No such window: $h" }
  if (-not [OcadeCap]::IsWindowVisible($ptr)) { throw "Window is not visible: $h" }
  $raw = New-Object OcadeCap+RECT
  [void][OcadeCap]::GetWindowRect($ptr, [ref]$raw)
  $ext = New-Object OcadeCap+RECT
  # 9 = DWMWA_EXTENDED_FRAME_BOUNDS
  $hr = [OcadeCap]::DwmGetWindowAttribute($ptr, 9, [ref]$ext, 16)
  if ($hr -ne 0) { $ext = $raw }
  $sb = New-Object System.Text.StringBuilder 512
  [void][OcadeCap]::GetWindowText($ptr, $sb, 512)
  $title = $sb.ToString()

  <#
    RENDER SCALE — the difference between how big a window LOOKS and how big it
    DRAWS ITSELF.

    A DPI-unaware application on a 125% display still renders at 96 DPI; Windows
    then bitmap-stretches the result to fill its on-screen rectangle. PrintWindow
    asks the window to draw itself, so it returns the UNSTRETCHED rendering.

    Sizing the capture bitmap from the on-screen (DWM) rectangle therefore left a
    black band over roughly a third of the image at 125% — the window painted
    746x413 into a 932x516 canvas. The window's own DPI is what determines how
    much it will actually paint.
  #>
  $windowDpi = [OcadeCap]::GetDpiForWindow($ptr)
  $mon = [OcadeCap]::MonitorFromWindow($ptr, 2) # MONITOR_DEFAULTTONEAREST
  $mx = 0; $my = 0
  [void][OcadeCap]::GetDpiForMonitor($mon, 0, [ref]$mx, [ref]$my) # 0 = MDT_EFFECTIVE_DPI
  if ($windowDpi -le 0) { $windowDpi = 96 }
  if ($mx -le 0) { $mx = 96 }
  $renderScale = [double]$mx / [double]$windowDpi
  [pscustomobject]@{
    hwnd = $h
    title = $title
    windowRect = @{ x = $raw.Left; y = $raw.Top; w = $raw.Right - $raw.Left; h = $raw.Bottom - $raw.Top }
    visibleRect = @{ x = $ext.Left; y = $ext.Top; w = $ext.Right - $ext.Left; h = $ext.Bottom - $ext.Top }
    dpi = $windowDpi
    monitorDpi = $mx
    monitorScalePercent = [math]::Round($mx / 96 * 100)
    # >1 means the window draws smaller than it appears and Windows stretches it.
    renderScale = [math]::Round($renderScale, 4)
    renderSize = @{
      w = [int][math]::Round(($ext.Right - $ext.Left) / $renderScale)
      h = [int][math]::Round(($ext.Bottom - $ext.Top) / $renderScale)
    }
    scalePercent = [math]::Round($windowDpi / 96 * 100)
    dpiAware = (-not $DpiUnaware.IsPresent)
    processAwarenessSet = $processAwarenessSet
    threadAwarenessSet = $threadAwarenessSet
  }
}

switch ($Mode) {
  "dpi" {
    $s = [System.Windows.Forms.Screen]::AllScreens | ForEach-Object {
      @{ device = $_.DeviceName; primary = $_.Primary; bounds = "$($_.Bounds)" }
    }
    @{ monitors = $s; processDpiAware = (-not $DpiUnaware.IsPresent) } | ConvertTo-Json -Depth 5 -Compress
  }

  "capture" {
    $info = Get-WindowInfo $Hwnd
    # Size the canvas to what the window will actually PAINT, not to how large it
    # appears on screen. `renderScale` carries the relationship, so a caller
    # mapping a point in this image back to a screen coordinate multiplies by it.
    if ($NaiveSize) {
      $w = $info.visibleRect.w; $h = $info.visibleRect.h
    } else {
      $w = $info.renderSize.w; $h = $info.renderSize.h
    }
    if ($w -le 0 -or $h -le 0) { throw "Window has no visible area" }
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $hdc = $g.GetHdc()
    # 2 = PW_RENDERFULLCONTENT
    $ok = [OcadeCap]::PrintWindow([IntPtr]$Hwnd, $hdc, 2)
    $g.ReleaseHdc($hdc)
    $g.Dispose()
    if (-not $ok) { $bmp.Dispose(); throw "PrintWindow refused to render window $Hwnd" }
    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $dims = @{ width = $bmp.Width; height = $bmp.Height }

    <#
      How much of the canvas did the window decline to paint?

      Unpainted area stays at the bitmap's zeroed fill, so a mis-sized capture
      shows up as a large fully-transparent/black region. Measuring it turns the
      DPI bug that produced a 34% black band into something a test can fail on,
      instead of something only a human looking at the picture would notice.
      Sampled on a grid rather than per-pixel to keep this cheap on big windows.
    #>
    $unpainted = 0; $sampled = 0
    $stepX = [Math]::Max(1, [int]($bmp.Width / 120))
    $stepY = [Math]::Max(1, [int]($bmp.Height / 120))
    for ($y = 0; $y -lt $bmp.Height; $y += $stepY) {
      for ($x = 0; $x -lt $bmp.Width; $x += $stepX) {
        $px = $bmp.GetPixel($x, $y)
        $sampled++
        # Alpha 0 ONLY. A first version also counted opaque black, which scored
        # the window's own border and body text as "unpainted" and reported 2.4%
        # on a perfectly good capture. Black is content; untouched canvas is
        # transparent.
        if ($px.A -eq 0) { $unpainted++ }
      }
    }
    $unpaintedFraction = if ($sampled -gt 0) { [math]::Round($unpainted / $sampled, 4) } else { 0 }
    $bmp.Dispose()
    $sha = (Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToLower()
    @{
      ok = $true; path = $Path; image = $dims; sha256 = $sha
      bytes = (Get-Item $Path).Length
      unpaintedFraction = $unpaintedFraction
      window = $info
    } | ConvertTo-Json -Depth 6 -Compress
  }

  "ocr" {
    # Windows.Media.Ocr — the OCR engine shipped with Windows. No model
    # download, no third-party service, and no image leaves the machine.
    [void][Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
    [void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
    [void][Windows.Media.Ocr.OcrEngine, Windows.Media, ContentType = WindowsRuntime]
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
      $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
      $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]
    function Await($op, $t) {
      $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op))
      [void]$task.Wait(-1)
      $task.Result
    }
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if ($null -eq $engine) { throw "No OCR language pack is installed for this user profile" }
    $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($Path)) ([Windows.Storage.StorageFile])
    $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    $lines = @($result.Lines | ForEach-Object { $_.Text })
    @{
      ok = $true
      engineLanguage = $engine.RecognizerLanguage.LanguageTag
      text = $result.Text
      lines = $lines
      lineCount = $lines.Count
    } | ConvertTo-Json -Depth 5 -Compress
  }
}
