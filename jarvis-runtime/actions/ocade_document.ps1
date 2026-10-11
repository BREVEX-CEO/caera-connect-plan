# OCADE JARVIS: one document job in the person's real Word (Windows).
#
# Reads a JSON job {path, ops[], close} and writes one JSON result line.
# Text reaches Word only through COM properties (never evaluated as script).
# A Word that is already running is used, and a document the person already
# has open is edited in place; otherwise it opens in a visible Word.
# After the edits: save, and (when OCADE opened it) close and reopen it to read
# back what was really saved.
param([Parameter(Mandatory = $true)][string]$JobFile)

$ErrorActionPreference = "Stop"
$job = Get-Content -Raw -Encoding UTF8 -LiteralPath $JobFile | ConvertFrom-Json
$missing = [Type]::Missing

function Out-Result($result) {
  [Console]::Out.WriteLine(($result | ConvertTo-Json -Depth 6 -Compress))
}

function Read-Doc($doc) {
  $text = $doc.Content.Text
  if ($text.Length -gt 20000) { $text = $text.Substring(0, 20000) }
  $headings = @()
  foreach ($p in $doc.Paragraphs) {
    $style = [string]$p.Style.NameLocal
    if ($style -like "Heading*" -or $style -eq "Title") { $headings += "$style|$($p.Range.Text.Trim())" }
    if ($headings.Count -ge 50) { break }
  }
  return @{ text = $text; paragraphs = $doc.Paragraphs.Count; tables = $doc.Tables.Count; headings = $headings }
}

$word = $null; $opened = $false; $doc = $null; $applied = @()
try {
  try { $word = [Runtime.InteropServices.Marshal]::GetActiveObject([string]$job.progId) }
  catch { $word = New-Object -ComObject ([string]$job.progId) }
  $word.Visible = $true
  $alerts = $word.DisplayAlerts
  $word.DisplayAlerts = 0
  $full = [IO.Path]::GetFullPath($job.path)
  foreach ($candidate in $word.Documents) { if ($candidate.FullName -ieq $full) { $doc = $candidate } }
  if ($null -eq $doc) {
    # A document JARVIS opens never runs its macros (3 = force disable).
    $security = $word.AutomationSecurity
    $word.AutomationSecurity = 3
    try { $doc = $word.Documents.Open($full); $opened = $true }
    finally { $word.AutomationSecurity = $security }
  }
  if ($doc.ReadOnly) { throw "The document is open read-only somewhere else" }

  foreach ($op in $job.ops) {
    switch ($op.op) {
      "replace" {
        $range = $doc.Content
        $find = $range.Find
        $find.ClearFormatting(); $find.Replacement.ClearFormatting()
        # Execute(FindText, MatchCase, MatchWholeWord, MatchWildcards, MatchSoundsLike,
        #         MatchAllWordForms, Forward, Wrap, Format, ReplaceWith, Replace)
        [void]$find.Execute([string]$op.find, [bool]$op.matchCase, $false, $false, $false, $false, $true, 0, $false, [string]$op.with, 2)
      }
      "append" {
        # An empty document holds one empty paragraph: write into it rather than after it.
        if ($doc.Content.Text.Trim().Length -eq 0) { $doc.Content.Text = [string]$op.text }
        else { $doc.Content.InsertAfter("`r" + [string]$op.text) }
        if ($null -ne $op.style) { $doc.Paragraphs.Last.Style = [int]$op.style }
      }
      "style" {
        foreach ($p in $doc.Paragraphs) {
          if ($p.Range.Text.Contains([string]$op.find)) { $p.Style = [int]$op.style }
        }
      }
      { $_ -in "bold", "italic", "highlight" } {
        $range = $doc.Content
        $find = $range.Find
        $find.ClearFormatting()
        $guard = 0
        while ($guard -lt 500 -and $find.Execute([string]$op.find)) {
          $guard++
          if ($op.op -eq "bold") { $range.Font.Bold = $true }
          elseif ($op.op -eq "italic") { $range.Font.Italic = $true }
          else { $range.HighlightColorIndex = 7 }  # yellow
          $range.Collapse(0)
        }
      }
      "table" {
        $rows = @($op.rows)
        $cols = @($rows[0]).Count
        $doc.Content.InsertParagraphAfter()
        $end = $doc.Paragraphs.Last.Range
        $table = $doc.Tables.Add($end, $rows.Count, $cols)
        $table.Borders.Enable = $true  # visible grid in any Word language
        for ($r = 0; $r -lt $rows.Count; $r++) {
          for ($c = 0; $c -lt $cols; $c++) { $table.Cell($r + 1, $c + 1).Range.Text = [string]@($rows[$r])[$c] }
        }
        if ($op.header) { $table.Rows.Item(1).Range.Font.Bold = $true }
      }
      default { throw "Unknown operation $($op.op)" }
    }
    $applied += [string]$op.op
  }

  $doc.Save()
  $read = Read-Doc $doc
  $reopened = $false
  if ($opened) {
    $doc.Close(0)
    $security = $word.AutomationSecurity
    $word.AutomationSecurity = 3  # reading it back is an open too: its macros never run
    try { $doc = $word.Documents.Open($full) }
    finally { $word.AutomationSecurity = $security }
    $again = Read-Doc $doc
    $reopened = ($again.text -eq $read.text) -and ($again.tables -eq $read.tables)
    if ($job.close) {
      $doc.Close(0)
      if ($word.Documents.Count -eq 0) { $word.Quit() }
    }
  }
  if (-not $job.close) { $word.DisplayAlerts = $alerts }
  Out-Result @{ ok = $true; engine = "automation"; applied = $applied; read = $read; savedAndReopened = $reopened }
}
catch {
  if ($opened -and $doc) { try { $doc.Close(0) } catch {} }
  if ($word) { try { $word.DisplayAlerts = if ($null -ne $alerts) { $alerts } else { -1 } } catch {} }
  Out-Result @{ ok = $false; engine = "automation"; applied = $applied; error = $_.Exception.Message
    unsavedEdits = ((-not $opened) -and $null -ne $doc -and $applied.Count -gt 0) }
}
