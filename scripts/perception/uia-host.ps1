# UI Automation host: the accessibility source behind `perception.ts`.
#
# `RawPerceptionElement` in src/lib/control/perception.ts expects an
# `accessibility` source with real roles, names, bounds and state. This produces
# exactly that shape from the live UI Automation tree, so the fused Set-of-Mark
# plan is built on what the operating system reports a control to BE — not on
# boxes guessed from pixels.
#
# It is also what makes the keyboard claim checkable. `IsKeyboardFocusable` is
# the same property a screen reader relies on, so an element that is marked but
# not focusable is a defect this host can surface rather than hide.
param(
  [Parameter(Mandatory = $true)][ValidateSet("elements", "focused", "tab", "invoke", "click")] [string]$Mode,
  [int64]$Hwnd = 0,
  [string]$Name = "",
  [int]$MaxTabs = 20,
  [int]$X = 0,
  [int]$Y = 0
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class UiaWin {
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr SetFocus(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, IntPtr e);
}
'@
# Per-monitor aware, so BoundingRectangle comes back in real device pixels and
# lines up with the capture host's coordinates on a scaled display.
[void][UiaWin]::SetProcessDpiAwarenessContext([IntPtr](-4))

$root = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$Hwnd)
if ($null -eq $root) { throw "No automation element for window $Hwnd" }

function Get-Elements {
  $found = $root.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition
  )
  $list = @()
  $index = 0
  foreach ($el in $found) {
    $c = $el.Current
    $index++
    $r = $c.BoundingRectangle
    if ([double]::IsInfinity($r.X) -or $r.Width -le 0 -or $r.Height -le 0) { continue }
    $type = $c.ControlType.ProgrammaticName -replace '^ControlType\.', ''
    # "Interactive" means the OS says it can be invoked or focused — not that it
    # merely looks clickable. A static label is visible and enabled but is not a
    # thing to click, and marking one would be a lie in the overlay.
    $interactive = $c.IsKeyboardFocusable -or
      ($type -in @("Button", "CheckBox", "RadioButton", "Edit", "ComboBox", "Hyperlink", "MenuItem", "Tab", "TabItem", "ListItem", "Slider"))
    $list += [pscustomobject]@{
      source = "accessibility"
      <#
        `perception.ts` enforces SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,199}$/i on
        sourceId, and a first version pasted the raw UIA Name straight in. Names
        like "Keep a backup copy" contain spaces, so the whole frame was rejected
        with "a perception source returned malformed or out-of-window data" — the
        gate doing its job on my input, not a bug in it.

        The slug keeps the element identifiable while satisfying the pattern. The
        tree index is included because two controls can legitimately share a name
        (a button and its inner text label both report "Save"), and sourceId
        feeds targetKey, which must be unique per element.
      #>
      sourceId = ("uia.{0}.{1}.{2}" -f $index, $type.ToLower(), (($c.Name -replace '[^a-zA-Z0-9]+', '-').Trim('-').ToLower()))
      role = $type
      name = $c.Name
      bounds = @{
        x = [math]::Round($r.X); y = [math]::Round($r.Y)
        width = [math]::Round($r.Width); height = [math]::Round($r.Height)
      }
      coordinateSpace = "screen_physical"
      confidence = 0.99
      interactive = [bool]$interactive
      enabled = [bool]$c.IsEnabled
      visible = (-not $c.IsOffscreen)
      focused = [bool]$c.HasKeyboardFocus
      keyboardFocusable = [bool]$c.IsKeyboardFocusable
      automationId = $c.AutomationId
    }
  }
  return $list
}

function Get-Focused {
  $el = [System.Windows.Automation.AutomationElement]::FocusedElement
  if ($null -eq $el) { return $null }
  $c = $el.Current
  return [pscustomobject]@{
    name = $c.Name
    role = ($c.ControlType.ProgrammaticName -replace '^ControlType\.', '')
    automationId = $c.AutomationId
  }
}

switch ($Mode) {
  "elements" {
    @{ ok = $true; elements = @(Get-Elements) } | ConvertTo-Json -Depth 6 -Compress
  }

  "focused" {
    @{ ok = $true; focused = (Get-Focused) } | ConvertTo-Json -Depth 5 -Compress
  }

  "tab" {
    <#
      Walk the focus chain with real Tab keystrokes.

      This is deliberately not "ask UIA for the tab order". Pressing Tab and
      reading back which element the OS says now has focus is the same path a
      keyboard user takes, so it proves reachability rather than intent. The
      trail of every stop is returned, so a claim of "reached in N tabs" can be
      checked against where focus actually went.
    #>
    [void][UiaWin]::SetForegroundWindow([IntPtr]$Hwnd)
    Start-Sleep -Milliseconds 400
    $trail = @()
    $reached = $false
    $steps = 0
    $start = Get-Focused
    if ($start -and $start.Name -eq $Name) { $reached = $true }
    while (-not $reached -and $steps -lt $MaxTabs) {
      [System.Windows.Forms.SendKeys]::SendWait("{TAB}")
      Start-Sleep -Milliseconds 220
      $steps++
      $cur = Get-Focused
      $trail += [pscustomobject]@{ step = $steps; name = $cur.Name; role = $cur.role }
      if ($cur -and $cur.Name -eq $Name) { $reached = $true }
    }
    @{
      ok = $true; target = $Name; reached = $reached; tabPresses = $steps
      startedAt = $start; trail = $trail; focusedAtEnd = (Get-Focused)
    } | ConvertTo-Json -Depth 6 -Compress
  }

  "click" {
    <#
      A REAL mouse click at a real screen coordinate.

      Deliberately not the UIA Invoke pattern. Invoke tells the control to
      activate itself, which would prove the control works but would bypass hit
      testing entirely — a click landing on the wrong element, or on a disabled
      one, would still "succeed". Moving the physical cursor and pressing the
      physical button is the thing that can actually miss, which is what makes
      post-action verification worth running.
    #>
    [void][UiaWin]::SetForegroundWindow([IntPtr]$Hwnd)
    Start-Sleep -Milliseconds 300
    [void][UiaWin]::SetCursorPos($X, $Y)
    Start-Sleep -Milliseconds 150
    [UiaWin]::mouse_event(0x0002, 0, 0, 0, [IntPtr]::Zero) # LEFTDOWN
    Start-Sleep -Milliseconds 60
    [UiaWin]::mouse_event(0x0004, 0, 0, 0, [IntPtr]::Zero) # LEFTUP
    Start-Sleep -Milliseconds 500
    @{ ok = $true; clickedAt = @{ x = $X; y = $Y } } | ConvertTo-Json -Depth 4 -Compress
  }

  "invoke" {
    # Press the control the way a keyboard user does: focus it, then Space.
    # Using the UIA Invoke pattern would prove the element is invokable but not
    # that the KEYBOARD reaches it.
    [void][UiaWin]::SetForegroundWindow([IntPtr]$Hwnd)
    Start-Sleep -Milliseconds 300
    [System.Windows.Forms.SendKeys]::SendWait(" ")
    Start-Sleep -Milliseconds 400
    @{ ok = $true; focusedAfter = (Get-Focused) } | ConvertTo-Json -Depth 5 -Compress
  }
}
