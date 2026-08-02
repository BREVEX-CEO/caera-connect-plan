# A real window with real interactive controls, for Set-of-Mark and keyboard proof.
#
# WPF, NOT WinForms — and that was a measured decision, not a preference.
#
# The first version of this used WinForms. UI Automation reported every single
# control as ControlType.Pane with IsKeyboardFocusable = False, because WinForms
# controls expose only legacy MSAA and each one appears to UIA as a bare HWND.
# Registering UIAutomationClientsideProviders on the client side did not fix it
# (RegisterClientSideProviderAssembly threw, and the types stayed Pane).
#
# Marking elements the accessibility tree calls "Pane" would have meant the
# overlay's numbered boxes were sitting on things the OS does not agree are
# controls, and the keyboard claim would have had nothing to stand on. WPF has
# native UIA providers: Button, CheckBox and Edit come back as themselves, with
# real IsKeyboardFocusable and a real focus chain.
#
# The tab order is deliberately NOT the visual order. Save sits third from the
# left but fourth in the tab sequence, so "reachable by keyboard" has to be
# established by walking the focus chain rather than by counting boxes in the
# picture.
Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase, UIAutomationTypes

$window = New-Object System.Windows.Window
$window.Title = "OCADE-INTERACTIVE"
$window.Width = 820
$window.Height = 460
$window.Left = 140
$window.Top = 140
$window.WindowStartupLocation = "Manual"
$window.ResizeMode = "NoResize"
$window.Background = [System.Windows.Media.Brushes]::White
$window.FontFamily = New-Object System.Windows.Media.FontFamily("Segoe UI")
$window.FontSize = 15

$canvas = New-Object System.Windows.Controls.Canvas
$window.Content = $canvas

function Place($ctl, $x, $y, $w, $h) {
  [System.Windows.Controls.Canvas]::SetLeft($ctl, $x)
  [System.Windows.Controls.Canvas]::SetTop($ctl, $y)
  $ctl.Width = $w
  $ctl.Height = $h
  $canvas.Children.Add($ctl) | Out-Null
  return $ctl
}

function New-Button($text, $tab) {
  $b = New-Object System.Windows.Controls.Button
  $b.Content = $text
  # AutomationProperties.Name is what UIA reports and what a screen reader
  # announces, so the label a model sees and the label a user hears are one
  # string, not two that can drift apart.
  [System.Windows.Automation.AutomationProperties]::SetName($b, $text)
  [System.Windows.Input.KeyboardNavigation]::SetTabIndex($b, $tab)
  return $b
}

$label = New-Object System.Windows.Controls.TextBlock
$label.Text = "Document title"
Place $label 40 34 240 26 | Out-Null

$box = New-Object System.Windows.Controls.TextBox
$box.Text = "quarterly-report"
[System.Windows.Automation.AutomationProperties]::SetName($box, "Document title")
[System.Windows.Input.KeyboardNavigation]::SetTabIndex($box, 0)
Place $box 40 66 400 32 | Out-Null

$check = New-Object System.Windows.Controls.CheckBox
$check.Content = "Keep a backup copy"
[System.Windows.Automation.AutomationProperties]::SetName($check, "Keep a backup copy")
[System.Windows.Input.KeyboardNavigation]::SetTabIndex($check, 1)
Place $check 40 120 300 26 | Out-Null

<#
  The four buttons are shuffled into the four slots on every launch.

  Set-of-Mark numbers are assigned in reading order, so with a fixed layout
  anyone who had seen this file could name "the number of the Save button"
  without looking at the image at all — and the selection test would be
  measuring memory of the source, not perception of the screenshot. Shuffling
  means the only way to answer is to read the labels in the picture.

  Tab order stays bound to the SLOT, not to the label, so the tab position of a
  given button also moves between runs and cannot be memorised either.
#>
$order = @("Cancel", "Export", "Save", "Delete") | Sort-Object { Get-Random }
$slots = @(40, 220, 400, 580)
$buttons = @{}
for ($i = 0; $i -lt 4; $i++) {
  $buttons[$order[$i]] = Place (New-Button $order[$i] ($i + 2)) $slots[$i] 180 160 48
}
$cancel = $buttons["Cancel"]; $export = $buttons["Export"]
$save = $buttons["Save"]; $delete = $buttons["Delete"]

# A disabled control, so "interactive AND enabled" is not a free pass.
$archive = Place (New-Button "Archive" 6) 40 250 200 48
$archive.IsEnabled = $false

$status = New-Object System.Windows.Controls.TextBlock
$status.Text = "Ready"
[System.Windows.Automation.AutomationProperties]::SetName($status, "Status")
Place $status 400 264 360 26 | Out-Null

# Real, observable effects. Post-action verification (I3) needs controls whose
# click genuinely changes the screen, not ones that only report that they did.
$save.Add_Click({ $status.Text = "Saved quarterly-report" })
$export.Add_Click({ $status.Text = "Exported quarterly-report" })
$cancel.Add_Click({ $status.Text = "Cancelled" })
$delete.Add_Click({ $status.Text = "Deleted quarterly-report" })

$window.Add_ContentRendered({
  $window.Activate()
  $box.Focus() | Out-Null
  $helper = New-Object System.Windows.Interop.WindowInteropHelper($window)
  $out = @{
    hwnd = [int64]$helper.Handle
    title = $window.Title
    # The shuffled slot order, so the harness knows the ground truth without the
    # model being told it.
    buttonOrderLeftToRight = $order
    tabOrder = @("Document title", "Keep a backup copy") + $order
    disabled = @("Archive")
  } | ConvertTo-Json -Compress -Depth 5
  Set-Content -Path (Join-Path $env:TEMP "ocade-interactive-window.json") -Value $out -Encoding utf8
})

$app = New-Object System.Windows.Application
$app.Run($window) | Out-Null
