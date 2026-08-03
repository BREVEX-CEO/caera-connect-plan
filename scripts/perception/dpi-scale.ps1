# Read or set the display scale for the primary source, so DPI correctness can
# be tested on a real non-100% display rather than argued about.
#
# This touches a DISPLAY PREFERENCE and nothing else — not security, not policy,
# not any other system configuration. Every caller is expected to restore the
# original value in a finally block; `-Mode get` exists so the original can be
# captured first, and the restore verified afterwards.
#
# The scale lives behind DisplayConfigGetDeviceInfo/SetDeviceInfo with the
# DPI-scale info types. They are not in the public SDK headers but are the
# mechanism the Settings app itself uses, and they apply immediately with no
# sign-out — which is what makes an automatic restore possible.
param(
  [Parameter(Mandatory = $true)][ValidateSet("get", "set")] [string]$Mode,
  [int]$RelativeSteps = 0
)
$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class DpiCfg {
  [StructLayout(LayoutKind.Sequential)] public struct LUID { public uint Low; public int High; }
  [StructLayout(LayoutKind.Sequential)] public struct HDR { public int type; public int size; public LUID adapterId; public uint id; }
  [StructLayout(LayoutKind.Sequential)] public struct GET { public HDR header; public int min; public int cur; public int max; }
  [StructLayout(LayoutKind.Sequential)] public struct SET { public HDR header; public int rel; }
  [StructLayout(LayoutKind.Sequential)] public struct SRC { public LUID adapterId; public uint id; public uint modeIdx; public uint status; }
  [StructLayout(LayoutKind.Sequential)] public struct TGT { public LUID adapterId; public uint id; public uint modeIdx; public uint tech; public uint rot; public uint scal; public ulong refresh; public uint order; public int avail; public uint status; }
  [StructLayout(LayoutKind.Sequential)] public struct PATH { public SRC src; public TGT tgt; public uint flags; }
  [StructLayout(LayoutKind.Sequential)] public struct MODE { public uint infoType; public uint id; public LUID adapterId; public ulong a, b, c, d, e, f, g, h; }

  [DllImport("user32.dll")] public static extern int GetDisplayConfigBufferSizes(uint flags, out uint np, out uint nm);
  [DllImport("user32.dll")] public static extern int QueryDisplayConfig(uint flags, ref uint np, [Out] PATH[] p, ref uint nm, [Out] MODE[] m, IntPtr cur);
  [DllImport("user32.dll")] public static extern int DisplayConfigGetDeviceInfo(ref GET g);
  [DllImport("user32.dll")] public static extern int DisplayConfigSetDeviceInfo(ref SET s);

  public static PATH PrimaryPath() {
    uint np, nm;
    if (GetDisplayConfigBufferSizes(2 /* QDC_ONLY_ACTIVE_PATHS */, out np, out nm) != 0)
      throw new Exception("GetDisplayConfigBufferSizes failed");
    var paths = new PATH[np]; var modes = new MODE[nm];
    if (QueryDisplayConfig(2, ref np, paths, ref nm, modes, IntPtr.Zero) != 0)
      throw new Exception("QueryDisplayConfig failed");
    if (np == 0) throw new Exception("No active display path");
    return paths[0];
  }
  public static GET Read(PATH p) {
    var g = new GET();
    g.header.type = -3; // DISPLAYCONFIG_DEVICE_INFO_GET_DPI_SCALE
    g.header.size = Marshal.SizeOf(typeof(GET));
    g.header.adapterId = p.src.adapterId;
    g.header.id = p.src.id;
    if (DisplayConfigGetDeviceInfo(ref g) != 0) throw new Exception("Could not read the display scale");
    return g;
  }
  public static void Write(PATH p, int rel) {
    var s = new SET();
    s.header.type = -4; // DISPLAYCONFIG_DEVICE_INFO_SET_DPI_SCALE
    s.header.size = Marshal.SizeOf(typeof(SET));
    s.header.adapterId = p.src.adapterId;
    s.header.id = p.src.id;
    s.rel = rel;
    if (DisplayConfigSetDeviceInfo(ref s) != 0) throw new Exception("Could not set the display scale");
  }
}
'@

# Windows exposes scale as an index into this ladder, expressed RELATIVE to the
# monitor's recommended scale — so 0 always means "recommended", not "100%".
$LADDER = @(100, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500)
$path = [DpiCfg]::PrimaryPath()
$g = [DpiCfg]::Read($path)

# The recommended step is wherever relative 0 sits, so absolute percentages can
# be reported instead of opaque relative indices.
$recIndex = -$g.min
function Pct([int]$rel) {
  $i = $recIndex + $rel
  if ($i -lt 0 -or $i -ge $LADDER.Count) { return $null }
  return $LADDER[$i]
}

if ($Mode -eq "get") {
  @{
    currentRelative = $g.cur; minRelative = $g.min; maxRelative = $g.max
    currentPercent = (Pct $g.cur); recommendedPercent = (Pct 0)
    availablePercent = @($g.min..$g.max | ForEach-Object { Pct $_ } | Where-Object { $_ })
  } | ConvertTo-Json -Compress
} else {
  if ($RelativeSteps -lt $g.min -or $RelativeSteps -gt $g.max) {
    throw "Requested step $RelativeSteps is outside the supported range $($g.min)..$($g.max)"
  }
  [DpiCfg]::Write($path, $RelativeSteps)
  Start-Sleep -Milliseconds 1200
  $after = [DpiCfg]::Read($path)
  @{
    requestedRelative = $RelativeSteps
    appliedRelative = $after.cur
    appliedPercent = (Pct $after.cur)
    applied = ($after.cur -eq $RelativeSteps)
  } | ConvertTo-Json -Compress
}
