# OCADE wake-phrase training audio, made on this computer with Windows' own voices.
# No download: Windows OneCore voices (and the classic desktop voices) speak SSML into
# WAV files. Input: a UTF-8 JSON list of {"file", "voice", "ssml"}; existing files are kept.
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/wake/synthesize.ps1 -Jobs jobs.json
param([Parameter(Mandatory = $true)][string]$Jobs)
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Speech
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($operation, [Type]$type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($operation))
  $task.Wait() | Out-Null
  $task.Result
}

$onecore = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$voices = @{}
foreach ($v in [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices) { $voices[$v.DisplayName] = $v }
$desktop = New-Object System.Speech.Synthesis.SpeechSynthesizer

$made = 0; $failed = 0
foreach ($job in (Get-Content -Raw -Encoding UTF8 $Jobs | ConvertFrom-Json)) {
  if (Test-Path $job.file) { continue }
  try {
    if ($voices.ContainsKey($job.voice)) {
      $onecore.Voice = $voices[$job.voice]
      $stream = Await ($onecore.SynthesizeSsmlToStreamAsync($job.ssml)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
      $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
      $size = [uint32]$stream.Size
      $null = Await ($reader.LoadAsync($size)) ([uint32])
      $bytes = New-Object byte[] $size
      $reader.ReadBytes($bytes)
      [System.IO.File]::WriteAllBytes($job.file, $bytes)
      $reader.Dispose(); $stream.Dispose()
    } else {
      $desktop.SelectVoice($job.voice)
      $desktop.SetOutputToWaveFile($job.file)
      $desktop.SpeakSsml($job.ssml)
      $desktop.SetOutputToNull()
    }
    $made++
  } catch {
    $failed++
  }
}
Write-Output "made $made failed $failed"
