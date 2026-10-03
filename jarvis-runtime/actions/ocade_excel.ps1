# OCADE JARVIS: one spreadsheet job in the person's real Excel (Windows).
#
# Reads a JSON job {path, sheet, ops[], read[]} and writes one JSON result line.
# Values reach Excel only through COM properties (never evaluated as script).
# An Excel that is already running is used, and a workbook the person already
# has open is edited in place; otherwise the workbook opens in a visible Excel.
# After the edits: recalculate, save, and (when OCADE opened it) close and
# reopen it to read back what was really saved.
param([Parameter(Mandatory = $true)][string]$JobFile)

$ErrorActionPreference = "Stop"
$job = Get-Content -Raw -Encoding UTF8 -LiteralPath $JobFile | ConvertFrom-Json
$missing = [Type]::Missing

function Out-Result($result) {
  [Console]::Out.WriteLine(($result | ConvertTo-Json -Depth 8 -Compress))
}

function Color($hex) {
  $h = $hex.TrimStart('#')
  $r = [Convert]::ToInt32($h.Substring(0, 2), 16)
  $g = [Convert]::ToInt32($h.Substring(2, 2), 16)
  $b = [Convert]::ToInt32($h.Substring(4, 2), 16)
  return $r + 256 * $g + 65536 * $b  # Excel wants BGR
}

function Read-Range($sheet, $address) {
  $range = $sheet.Range($address)
  $rows = [Math]::Min($range.Rows.Count, 50)
  $cols = [Math]::Min($range.Columns.Count, 20)
  $text = @(); $formulas = @()
  for ($r = 1; $r -le $rows; $r++) {
    $t = @(); $f = @()
    for ($c = 1; $c -le $cols; $c++) {
      $cell = $range.Cells.Item($r, $c)
      $t += [string]$cell.Text
      $f += [string]$cell.Formula
    }
    $text += , $t; $formulas += , $f
  }
  return @{ text = $text; formulas = $formulas }
}

$excel = $null; $created = $false; $opened = $false; $book = $null
try {
  try { $excel = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application") }
  catch { $excel = New-Object -ComObject Excel.Application; $created = $true }
  $excel.Visible = $true
  $alerts = $excel.DisplayAlerts
  $excel.DisplayAlerts = $false
  $full = [IO.Path]::GetFullPath($job.path)
  foreach ($candidate in $excel.Workbooks) {
    if ($candidate.FullName -ieq $full) { $book = $candidate }
  }
  if ($null -eq $book) {
    # Excel holds one workbook per file name: another "report.xlsx" already open there means
    # ours opens in an Excel of its own (before, Open returned nothing and the job failed).
    $leaf = [IO.Path]::GetFileName($full)
    foreach ($candidate in $excel.Workbooks) {
      if ($candidate.Name -ieq $leaf) { $excel = New-Object -ComObject Excel.Application; $created = $true; $excel.Visible = $true; $alerts = $excel.DisplayAlerts; $excel.DisplayAlerts = $false; break }
    }
    # A workbook JARVIS opens never runs its macros (3 = force disable), whatever it is named.
    $security = $excel.AutomationSecurity
    $excel.AutomationSecurity = 3
    try { $book = $excel.Workbooks.Open($full); $opened = $true }
    finally { $excel.AutomationSecurity = $security }
  }
  if ($null -eq $book) { throw "Excel could not open the workbook" }
  if ($book.ReadOnly) { throw "The workbook is open read-only somewhere else" }
  if ($job.sheet) { $sheet = $book.Worksheets.Item([string]$job.sheet) }
  elseif ($opened) { $sheet = $book.Worksheets.Item(1) }
  else { $sheet = $book.ActiveSheet }

  $applied = @()
  foreach ($op in $job.ops) {
    # Direct assignment: a Range sent through the pipeline unrolls into its cells.
    $target = $null
    if ($op.range) { $target = $sheet.Range([string]$op.range) }
    elseif ($op.cell) { $target = $sheet.Range([string]$op.cell) }
    switch ($op.op) {
      "set" {
        $v = $op.value
        if ($v -is [string] -and $v.StartsWith("=")) { $target.Formula = $v } else { $target.Value2 = $v }
      }
      "fill" { $target.Formula = [string]$op.formula }
      "format" {
        if ($op.numberFormat) { $target.NumberFormat = [string]$op.numberFormat }
        if ($null -ne $op.bold) { $target.Font.Bold = [bool]$op.bold }
        if ($null -ne $op.italic) { $target.Font.Italic = [bool]$op.italic }
        if ($op.fontColor) { $target.Font.Color = Color $op.fontColor }
        if ($op.fillColor) { $target.Interior.Color = Color $op.fillColor }
        if ($op.align) { $target.HorizontalAlignment = @{ left = -4131; center = -4108; right = -4152 }[[string]$op.align] }
        if ($null -ne $op.wrap) { $target.WrapText = [bool]$op.wrap }
        if ($op.border -eq "none") { $target.Borders.LineStyle = -4142 }
        elseif ($op.border) {
          foreach ($edge in 7, 8, 9, 10, 11, 12) {
            $line = $target.Borders.Item($edge)
            $line.LineStyle = 1
            $line.Weight = @{ thin = 2; medium = -4138 }[[string]$op.border]
          }
        }
        if ($op.columnWidth -eq "auto") { [void]$target.EntireColumn.AutoFit() }
        elseif ($op.columnWidth) { $target.ColumnWidth = [double]$op.columnWidth }
      }
      "conditional" {
        $first = $target.Cells.Item(1, 1).Address($false, $false)
        switch ($op.rule) {
          "greater" { $fc = $target.FormatConditions.Add(1, 5, "=" + $op.value) }
          "less" { $fc = $target.FormatConditions.Add(1, 6, "=" + $op.value) }
          "equal" { $fc = $target.FormatConditions.Add(1, 3, "=" + $op.value) }
          "between" { $fc = $target.FormatConditions.Add(1, 1, "=" + $op.value, "=" + $op.value2) }
          "text_contains" {
            $needle = ([string]$op.value).Replace('"', '""')
            $fc = $target.FormatConditions.Add(2, $missing, "=ISNUMBER(SEARCH(""$needle""," + $first + "))")
          }
          "duplicate" { $fc = $target.FormatConditions.AddUniqueValues(); $fc.DupeUnique = 1 }
          "top" { $fc = $target.FormatConditions.AddTop10(); $fc.TopBottom = 1; $fc.Rank = [int]$op.value }
          default { throw "Unknown rule $($op.rule)" }
        }
        if ($op.fillColor) { $fc.Interior.Color = Color $op.fillColor }
        if ($op.fontColor) { $fc.Font.Color = Color $op.fontColor }
      }
      "table" {
        $table = $sheet.ListObjects.Add(1, $target, $missing, 1)
        if ($op.name) { $table.Name = [string]$op.name }
        if ($op.style) { $table.TableStyle = [string]$op.style }
      }
      "filter" { [void]$target.AutoFilter() }
      "freeze" {
        $book.Activate(); $sheet.Activate()
        $excel.ActiveWindow.FreezePanes = $false
        [void]$target.Select()
        $excel.ActiveWindow.FreezePanes = $true
      }
      "sheet_add" {
        $new = $book.Worksheets.Add($missing, $book.Worksheets.Item($book.Worksheets.Count))
        $new.Name = [string]$op.name
      }
      "sheet_rename" { $book.Worksheets.Item([string]$op.from).Name = [string]$op.to }
      "name" { [void]$book.Names.Add([string]$op.name, "=" + $target.Address($true, $true, 1, $true)) }
      "chart" {
        $anchor = $sheet.Range([string]$op.anchor)
        $shape = $sheet.ChartObjects().Add($anchor.Left, $anchor.Top, 480, 280)
        $shape.Chart.SetSourceData($sheet.Range([string]$op.source))
        $shape.Chart.ChartType = @{ column = 51; bar = 57; line = 4; pie = 5 }[[string]$op.kind]
        if ($op.title) { $shape.Chart.HasTitle = $true; $shape.Chart.ChartTitle.Text = [string]$op.title }
      }
      "sort" {
        $key = $sheet.Range([string]$op.by)
        $order = if ($op.descending) { 2 } else { 1 }
        [void]$target.Sort($key, $order, $missing, $missing, 1, $missing, 1, 1)
      }
      default { throw "Unknown operation $($op.op)" }
    }
    $applied += [string]$op.op
  }

  $excel.Calculate()
  $book.Save()
  $read = @{}
  foreach ($address in $job.read) { $read[[string]$address] = Read-Range $sheet ([string]$address) }

  $reopened = $false
  if ($opened) {
    # Proof that it was saved: close it, open the saved file again, read it again.
    $name = $sheet.Name
    $book.Close($false)
    $book = $excel.Workbooks.Open($full)
    $sheet = $book.Worksheets.Item($name)
    $again = @{}
    foreach ($address in $job.read) { $again[[string]$address] = Read-Range $sheet ([string]$address) }
    $reopened = ($again | ConvertTo-Json -Depth 8 -Compress) -eq ($read | ConvertTo-Json -Depth 8 -Compress)
  }
  $sheetName = $sheet.Name
  if ($job.close -and $opened) {
    $book.Close($false)
    if ($created -and $excel.Workbooks.Count -eq 0) { $excel.Quit() }
  }
  else { $excel.DisplayAlerts = $alerts }
  Out-Result @{ ok = $true; engine = "excel"; applied = $applied; read = $read; savedAndReopened = $reopened; sheet = $sheetName }
}
catch {
  # A job that failed part-way is not saved; a workbook OCADE opened closes unchanged.
  if ($opened -and $book) { try { $book.Close($false) } catch {} }
  if ($excel) { try { $excel.DisplayAlerts = $true } catch {} }
  Out-Result @{ ok = $false; engine = "excel"; applied = $applied; error = $_.Exception.Message }
}
