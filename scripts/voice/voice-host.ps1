# OCADE voice host (Windows): microphone permission, capture, STT, TTS.
#
# `src/lib/ocade-voice.ts` already carries the wake-phrase matching, caption
# windowing and redaction logic, but nothing ever fed it a real microphone.
# This is that host. It is the only component here with audio-device authority.
#
# PERMISSION IS CHECKED BEFORE THE MICROPHONE IS OPENED, NOT AFTER
# ----------------------------------------------------------------
# Windows keeps microphone consent in the CapabilityAccessManager ConsentStore.
# `-Mode permission` reads it, and `-Mode capture` refuses to open the device
# unless it reads "Allow". Opening the mic first and apologising afterwards
# would be the wrong order, and on a machine where consent is denied the
# recording would silently come back as digital silence rather than as a
# refusal — which is far worse, because silence looks like a quiet room.
#
# Recording uses MCI (winmm), which needs no third-party audio library. The
# waveform format is pinned to 16-bit mono 16 kHz because that is what the
# desktop speech recogniser expects; leaving it at the driver default produced
# a file the recogniser accepted and transcribed as nothing at all.
param(
  [Parameter(Mandatory = $true)][ValidateSet("permission", "devices", "capture", "stt", "wake", "speak", "speak-metered", "speak-and-capture", "mix-noise", "capture-unavailable")]
  [string]$Mode,
  [string]$NoisePath = "",
  [double]$NoiseDb = -12,
  [double]$WakeThreshold = 0.6,
  [string]$Path = "",
  [double]$Seconds = 5,
  [string]$Text = "",
  [string]$Voice = "",
  [int]$InterruptAfterMs = 0
)
$ErrorActionPreference = "Stop"

$MIC_CONSENT = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone"

Add-Type -TypeDefinition @'
using System; using System.Text; using System.Runtime.InteropServices;
public static class Mci {
  [DllImport("winmm.dll", CharSet = CharSet.Unicode)]
  public static extern int mciSendString(string cmd, StringBuilder ret, int len, IntPtr cb);
  public static string Send(string cmd) {
    var sb = new StringBuilder(512);
    int rc = mciSendString(cmd, sb, sb.Capacity, IntPtr.Zero);
    if (rc != 0) {
      var err = new StringBuilder(512);
      mciGetErrorString(rc, err, err.Capacity);
      throw new Exception("MCI '" + cmd + "' failed: " + err.ToString());
    }
    return sb.ToString();
  }
  [DllImport("winmm.dll", CharSet = CharSet.Unicode)]
  public static extern bool mciGetErrorString(int err, StringBuilder buf, int len);
}
'@

function Get-MicConsent {
  $global = (Get-ItemProperty -Path $MIC_CONSENT -Name Value -ErrorAction SilentlyContinue).Value
  # Per-application consent lives in child keys; a global Allow with the calling
  # application denied would still fail, so both are reported.
  $apps = @()
  foreach ($scope in @("NonPackaged")) {
    $p = Join-Path $MIC_CONSENT $scope
    if (Test-Path $p) {
      Get-ChildItem $p -ErrorAction SilentlyContinue | ForEach-Object {
        $v = (Get-ItemProperty $_.PSPath -Name Value -ErrorAction SilentlyContinue).Value
        if ($v) { $apps += [pscustomobject]@{ app = $_.PSChildName; value = $v } }
      }
    }
  }
  [pscustomobject]@{
    globalValue = $global
    granted = ($global -eq "Allow")
    nonPackagedDenied = @($apps | Where-Object { $_.value -ne "Allow" } | Select-Object -First 5)
    checkedAt = (Get-Date).ToString("o")
  }
}

function Assert-MicPermission {
  $c = Get-MicConsent
  if (-not $c.granted) {
    throw "MICROPHONE PERMISSION NOT GRANTED (ConsentStore value '$($c.globalValue)'). OCADE will not open the microphone."
  }
  return $c
}

# Locate a RIFF chunk by id, rather than assuming a 44-byte header.
function Find-Chunk($bytes, $id) {
  $pos = 12
  while ($pos -lt $bytes.Length - 8) {
    $tag = [System.Text.Encoding]::ASCII.GetString($bytes, $pos, 4)
    $sz = [BitConverter]::ToInt32($bytes, $pos + 4)
    if ($tag -eq $id) { return @{ offset = $pos + 8; size = $sz } }
    $pos += 8 + $sz + ($sz % 2)
  }
  return $null
}

function Get-WavFormat($bytes) {
  $f = Find-Chunk $bytes "fmt "
  if (-not $f) { return $null }
  @{
    channels = [BitConverter]::ToInt16($bytes, $f.offset + 2)
    sampleRate = [BitConverter]::ToInt32($bytes, $f.offset + 4)
    bits = [BitConverter]::ToInt16($bytes, $f.offset + 14)
  }
}

<#
  Downmix to mono and resample to 16 kHz for the recogniser.

  Channels are averaged rather than one being dropped, so a signal arriving
  mostly on one side of the array is not thrown away. Resampling is linear
  interpolation, which is more than adequate for speech at this ratio and
  keeps the host free of any audio dependency.
#>
function Convert-ToMono16k($inFile, $outFile) {
  $bytes = [System.IO.File]::ReadAllBytes($inFile)
  $fmt = Get-WavFormat $bytes
  $data = Find-Chunk $bytes "data"
  if (-not $fmt -or -not $data) { throw "Unreadable WAV: $inFile" }
  $end = [Math]::Min($data.offset + $data.size, $bytes.Length)
  $ch = [int]$fmt.channels
  $frameBytes = 2 * $ch
  $frames = [int](($end - $data.offset) / $frameBytes)
  $mono = New-Object 'double[]' $frames
  for ($i = 0; $i -lt $frames; $i++) {
    $off = $data.offset + $i * $frameBytes
    $sum = 0.0
    for ($c = 0; $c -lt $ch; $c++) { $sum += [BitConverter]::ToInt16($bytes, $off + $c * 2) }
    $mono[$i] = $sum / $ch
  }
  $ratio = [double]$fmt.sampleRate / 16000.0
  $outCount = [int]([Math]::Floor($frames / $ratio))
  $out = New-Object 'byte[]' ($outCount * 2)
  for ($i = 0; $i -lt $outCount; $i++) {
    $src = $i * $ratio
    $i0 = [int][Math]::Floor($src)
    $i1 = [Math]::Min($i0 + 1, $frames - 1)
    $frac = $src - $i0
    $v = [int][Math]::Round($mono[$i0] * (1 - $frac) + $mono[$i1] * $frac)
    if ($v -gt 32767) { $v = 32767 }; if ($v -lt -32768) { $v = -32768 }
    [BitConverter]::GetBytes([int16]$v).CopyTo($out, $i * 2)
  }
  $fs = [System.IO.File]::Create($outFile)
  $bw = New-Object System.IO.BinaryWriter($fs)
  $bw.Write([System.Text.Encoding]::ASCII.GetBytes("RIFF"))
  $bw.Write([int](36 + $out.Length))
  $bw.Write([System.Text.Encoding]::ASCII.GetBytes("WAVEfmt "))
  $bw.Write([int]16); $bw.Write([int16]1); $bw.Write([int16]1)
  $bw.Write([int]16000); $bw.Write([int]32000); $bw.Write([int16]2); $bw.Write([int16]16)
  $bw.Write([System.Text.Encoding]::ASCII.GetBytes("data"))
  $bw.Write([int]$out.Length)
  $bw.Write($out)
  $bw.Close(); $fs.Close()
  return $outFile
}

function Get-WavStats($file) {
  # Read the PCM payload and report real signal levels. A capture that returned
  # digital silence must be visible as such rather than passing as "audio".
  $bytes = [System.IO.File]::ReadAllBytes($file)
  if ($bytes.Length -lt 64) { return @{ samples = 0; rms = 0; peak = 0 } }
  $fmt = Get-WavFormat $bytes
  $d = Find-Chunk $bytes "data"
  if (-not $d) { return @{ samples = 0; rms = 0; peak = 0 } }
  $dataOff = $d.offset
  $end = [Math]::Min($dataOff + $d.size, $bytes.Length)
  $n = 0; $sum = 0.0; $peak = 0
  for ($i = $dataOff; $i -lt $end - 1; $i += 2) {
    $s = [BitConverter]::ToInt16($bytes, $i)
    $sum += [double]$s * $s
    $a = [Math]::Abs([int]$s)
    if ($a -gt $peak) { $peak = $a }
    $n++
  }
  if ($n -eq 0) { return @{ samples = 0; rms = 0; peak = 0 } }
  $rate = if ($fmt) { [int]$fmt.sampleRate } else { 16000 }
  $ch = if ($fmt) { [int]$fmt.channels } else { 1 }
  @{
    samples = $n
    channels = $ch
    sampleRate = $rate
    rms = [math]::Round([Math]::Sqrt($sum / $n), 1)
    peak = $peak
    rmsDbfs = [math]::Round(20 * [Math]::Log10([Math]::Max([Math]::Sqrt($sum / $n), 1) / 32768.0), 1)
    peakDbfs = [math]::Round(20 * [Math]::Log10([Math]::Max($peak, 1) / 32768.0), 1)
    durationSec = [math]::Round($n / [double]($rate * $ch), 2)
  }
}

function Start-Recording {
  # Clear any alias left behind by an earlier aborted run. This legitimately
  # fails when nothing is open, which is the normal case — only a real failure
  # to OPEN the device should stop us.
  try { [void][Mci]::Send("close rec") } catch { }
  [void][Mci]::Send("open new type waveaudio alias rec")
  <#
    STEREO at 44.1 kHz, because this microphone will not do anything else.

    The recogniser wants mono 16 kHz, so that is what was requested first — and
    the device refused every mono format outright ("no wave device is installed
    that can record files in the current format"), at 16k, 44.1k and 48k alike.
    Measured on this Intel Smart Sound array: 2ch/44100 and 2ch/48000 open, all
    1ch formats fail.

    So the capture is taken in the only format the hardware offers and converted
    afterwards. Setting alignment/bytespersec explicitly is also avoided: MCI
    derives them and rejects values it did not compute itself, even correct ones.
  #>
  [void][Mci]::Send("set rec format tag pcm")
  [void][Mci]::Send("set rec channels 2")
  [void][Mci]::Send("set rec samplespersec 44100")
  [void][Mci]::Send("set rec bitspersample 16")
  [void][Mci]::Send("record rec")
}

function Stop-Recording($file) {
  [void][Mci]::Send("stop rec")
  if (Test-Path $file) { Remove-Item $file -Force }
  [void][Mci]::Send("save rec `"$file`"")
  [void][Mci]::Send("close rec")
}

function Invoke-Stt($file) {
  Add-Type -AssemblyName System.Speech
  $bytes = [System.IO.File]::ReadAllBytes($file)
  $fmt = Get-WavFormat $bytes
  # The desktop recogniser only accepts mono 16 kHz; anything else is converted
  # first rather than being handed over and quietly transcribed as nothing.
  $sttFile = $file
  if (-not $fmt -or $fmt.channels -ne 1 -or $fmt.sampleRate -ne 16000) {
    $sttFile = [System.IO.Path]::ChangeExtension($file, ".mono16k.wav")
    [void](Convert-ToMono16k $file $sttFile)
  }
  $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
  $engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
  $engine.SetInputToWaveFile($sttFile)
  $lines = @()
  # RecognizeAsync would need a message pump; a synchronous loop over the file
  # is enough here and cannot hang past end-of-stream.
  while ($true) {
    # At end-of-stream the engine THROWS ("no audio input is supplied") rather
    # than returning null, so the null check alone was not enough — a clean
    # transcription ended in an exception that looked like a broken recogniser.
    try { $r = $engine.Recognize() } catch { break }
    if ($null -eq $r) { break }
    $lines += [pscustomobject]@{ text = $r.Text; confidence = [math]::Round($r.Confidence, 3) }
  }
  $engine.Dispose()
  return $lines
}

switch ($Mode) {
  "mix-noise" {
    <#
      Add REAL broadband noise to a real speech waveform at a measured level.

      This is not a synthetic "pretend it went wrong" flag — the samples are
      genuinely corrupted, the recogniser genuinely has to cope, and the
      resulting signal-to-noise ratio is computed from the two waveforms rather
      than assumed from the requested level. J3 is about noise not silently
      corrupting a transcript, so the corruption has to be real for the
      INDICATION to be worth anything.
    #>
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $fmt = Get-WavFormat $bytes
    $d = Find-Chunk $bytes "data"
    if (-not $fmt -or -not $d) { throw "Unreadable WAV: $Path" }
    $end = [Math]::Min($d.offset + $d.size, $bytes.Length)
    $rand = New-Object System.Random 20260802
    $amp = [Math]::Pow(10, $NoiseDb / 20.0) * 32768.0
    $out = New-Object 'byte[]' ($end - $d.offset)
    $sigSum = 0.0; $noiseSum = 0.0; $n = 0
    for ($i = $d.offset; $i -lt $end - 1; $i += 2) {
      $s = [BitConverter]::ToInt16($bytes, $i)
      # Uniform noise summed twice approximates a Gaussian closely enough, and
      # keeps this dependency-free.
      $noise = (($rand.NextDouble() - 0.5) + ($rand.NextDouble() - 0.5)) * $amp
      $v = [int][Math]::Round($s + $noise)
      if ($v -gt 32767) { $v = 32767 }; if ($v -lt -32768) { $v = -32768 }
      [BitConverter]::GetBytes([int16]$v).CopyTo($out, $i - $d.offset)
      $sigSum += [double]$s * $s; $noiseSum += $noise * $noise; $n++
    }
    $hdr = $bytes[0..($d.offset - 1)]
    $fs = [System.IO.File]::Create($NoisePath)
    $fs.Write($hdr, 0, $hdr.Length); $fs.Write($out, 0, $out.Length); $fs.Close()
    $snr = if ($noiseSum -gt 0) { [math]::Round(10 * [Math]::Log10($sigSum / $noiseSum), 1) } else { $null }
    @{ ok = $true; out = $NoisePath; requestedNoiseDb = $NoiseDb; measuredSnrDb = $snr; samples = $n } | ConvertTo-Json -Compress
  }

  "capture-unavailable" {
    <#
      What happens when the capture device cannot be opened.

      A mono format is requested, which this microphone array genuinely refuses
      (measured: every 1ch rate fails while 2ch succeeds). The point is the
      SHAPE of the failure: MCI returns a specific error immediately and the
      host surfaces it, rather than blocking on a device that will never answer.
      Elapsed time is reported so "did not hang" is a measurement.

      This is NOT the same as physically unplugging a microphone mid-capture,
      and is not presented as such.
    #>
    $t0 = Get-Date
    $err = $null
    try {
      try { [void][Mci]::Send("close probe") } catch { }
      [void][Mci]::Send("open new type waveaudio alias probe")
      [void][Mci]::Send("set probe format tag pcm")
      [void][Mci]::Send("set probe channels 1")
      [void][Mci]::Send("set probe samplespersec 16000")
      [void][Mci]::Send("set probe bitspersample 16")
      [void][Mci]::Send("record probe")
      Start-Sleep -Milliseconds 200
      [void][Mci]::Send("stop probe")
    } catch {
      $err = $_.Exception.Message
    } finally {
      try { [void][Mci]::Send("close probe") } catch { }
    }
    $ms = [math]::Round(((Get-Date) - $t0).TotalMilliseconds)
    @{
      ok = $true
      failedFast = ($null -ne $err -and $ms -lt 5000)
      elapsedMs = $ms
      error = $err
      surfacedClearError = ($null -ne $err)
    } | ConvertTo-Json -Compress
  }

  "permission" { (Get-MicConsent) | ConvertTo-Json -Depth 5 -Compress }

  "devices" {
    Add-Type -AssemblyName System.Speech
    $rec = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() | ForEach-Object { $_.Id + " (" + $_.Culture + ")" }
    $syn = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $voices = $syn.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
    $syn.Dispose()
    @{ ok = $true; recognizers = @($rec); voices = @($voices) } | ConvertTo-Json -Depth 5 -Compress
  }

  "capture" {
    $consent = Assert-MicPermission
    Start-Recording
    Start-Sleep -Milliseconds ([int]($Seconds * 1000))
    Stop-Recording $Path
    $stats = Get-WavStats $Path
    @{
      ok = $true; path = $Path; permission = $consent; requestedSeconds = $Seconds
      audio = $stats
      bytes = (Get-Item $Path).Length
      sha256 = (Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToLower()
    } | ConvertTo-Json -Depth 6 -Compress
  }

  "stt" {
    $lines = Invoke-Stt $Path
    $confs = @($lines | ForEach-Object { $_.confidence })
    $minConf = if ($confs.Count -gt 0) { ($confs | Measure-Object -Minimum).Minimum } else { 0 }
    <#
      A DEGRADED TRANSCRIPT MUST ANNOUNCE ITSELF.

      Under noise this recogniser does not fall silent — it returns a fluent,
      completely wrong sentence. Measured on the same utterance: "The quick
      brown fox jumps over the lazy dog" at confidence 0.649 clean, and "All
      five F" at 0.173 with noise mixed in at ~1 dB SNR. Both look like ordinary
      successful results to a caller that only reads `text`.

      So the confidence floor is reported as an explicit warning rather than
      left for the caller to notice. Silently corrupting a transcript is the
      exact failure J3 is about.
    #>
    $low = ($lines.Count -eq 0 -or $minConf -lt $WakeThreshold)
    @{
      ok = $true; path = $Path
      text = (($lines | ForEach-Object { $_.text }) -join " ")
      segments = @($lines)
      minConfidence = $minConf
      confidenceFloor = $WakeThreshold
      lowConfidence = $low
      warning = if ($low) { "LOW CONFIDENCE: this transcript may be wrong. Confidence $minConf is below the floor of $WakeThreshold; treat it as unreliable rather than as what was said." } else { $null }
      audio = (Get-WavStats $Path)
    } | ConvertTo-Json -Depth 6 -Compress
  }

  "wake" {
    <#
      Wake-phrase detection with a CONSTRAINED GRAMMAR, not dictation.

      Dictation was tried first and cannot work here: "OCADE" is an invented
      proper noun that is not in the recogniser's lexicon, so "Hey OCADE, what
      time is it" came back as "Payer good what time is it". The honest fix is
      not to teach the matcher that "payer good" means OCADE — it is to stop
      asking a dictation model to produce a word it has never heard of.

      A grammar limited to the wake phrases is how wake-word detection actually
      works, and it is also why the rejection threshold matters: a constrained
      grammar will always report its CLOSEST phrase for any audio, so without a
      confidence floor every utterance "matches". The non-triggering control
      exists to prove that floor does real work.
    #>
    Add-Type -AssemblyName System.Speech
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $fmt = Get-WavFormat $bytes
    $sttFile = $Path
    if (-not $fmt -or $fmt.channels -ne 1 -or $fmt.sampleRate -ne 16000) {
      $sttFile = [System.IO.Path]::ChangeExtension($Path, ".mono16k.wav")
      [void](Convert-ToMono16k $Path $sttFile)
    }
    $phrases = if ($Text) { $Text -split "\|" } else { @("hello ocade", "hey ocade") }
    $choices = New-Object System.Speech.Recognition.Choices
    foreach ($p in $phrases) { $choices.Add([string]$p) }
    $gb = New-Object System.Speech.Recognition.GrammarBuilder
    $gb.Append($choices)
    $grammar = New-Object System.Speech.Recognition.Grammar($gb)
    $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
    $engine.LoadGrammar($grammar)
    $engine.SetInputToWaveFile($sttFile)
    $best = $null
    try { $best = $engine.Recognize() } catch { $best = $null }
    $engine.Dispose()
    $conf = if ($best) { [math]::Round($best.Confidence, 3) } else { 0 }
    $text = if ($best) { $best.Text } else { "" }
    @{
      ok = $true; path = $Path
      grammarPhrases = @($phrases)
      recognizedPhrase = $text
      confidence = $conf
      threshold = $WakeThreshold
      # Below the floor is a REJECTION, not a match. Reporting the closest
      # phrase without this would make every utterance look like a wake word.
      triggered = ($null -ne $best -and $conf -ge $WakeThreshold)
    } | ConvertTo-Json -Depth 5 -Compress
  }

  "speak-metered" {
    <#
      Prove the AUDIO stopped, not that the API said so.

      SpeakAsyncCancelAll returns immediately regardless, and the synthesiser's
      own State is still the synthesiser talking about itself. IAudioMeterInformation
      reads the peak sample value the audio engine is currently rendering on the
      output device — so this samples what the speaker is actually doing, before
      and after the interruption, and reports the whole trace rather than a
      verdict. Silence after the cut is then a measurement, not a claim.
    #>
    Add-Type -AssemblyName System.Speech
    Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] public class MMDeviceEnumeratorComObject { }
[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceEnumerator {
  // EnumAudioEndpoints occupies exactly ONE vtable slot before
  // GetDefaultAudioEndpoint. Declaring two placeholders here shifted every
  // later call by one slot and produced a null reference at Activate.
  int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr ppDevices);
  int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
}
[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice {
  int Activate(ref Guid iid, int clsCtx, IntPtr act, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
}
[ComImport, Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioMeterInformation { int GetPeakValue(out float pfPeak); }
public static class Meter {
  static IAudioMeterInformation m;
  public static void Init() {
    var e = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
    IMMDevice dev; e.GetDefaultAudioEndpoint(0 /*eRender*/, 0 /*eConsole*/, out dev);
    var iid = typeof(IAudioMeterInformation).GUID;
    object o; dev.Activate(ref iid, 23 /*CLSCTX_ALL*/, IntPtr.Zero, out o);
    m = (IAudioMeterInformation)o;
  }
  public static float Peak() { float p; m.GetPeakValue(out p); return p; }
}
'@
    [Meter]::Init()
    $syn = New-Object System.Speech.Synthesis.SpeechSynthesizer
    if ($Voice) { $syn.SelectVoice($Voice) }
    $syn.SetOutputToDefaultAudioDevice()
    $t0 = Get-Date
    $trace = @()
    <#
      LIVE CAPTIONS come from SpeakProgress, which fires per word AS the
      synthesiser reaches it. The character position it reports is what
      `captionSentenceAt` in src/lib/ocade-voice.ts windows into a caption line,
      so the captions are driven by playback position rather than by a timer
      pretending to track it. The list is synchronised because the event arrives
      on the synthesiser's thread, not this one.
    #>
    # Register-ObjectEvent, NOT Add_SpeakProgress with a scriptblock. The
    # synthesiser raises SpeakProgress on its own thread, and a PowerShell
    # scriptblock invoked from a foreign thread deadlocks the runspace — the
    # first version of this hung indefinitely with no output. Registered events
    # are queued and drained safely from the polling loop below.
    $captions = New-Object System.Collections.ArrayList
    Get-EventSubscriber -SourceIdentifier "OcadeSpeakProgress" -ErrorAction SilentlyContinue | Unregister-Event -Force
    [void](Register-ObjectEvent -InputObject $syn -EventName SpeakProgress -SourceIdentifier "OcadeSpeakProgress")
    [void]$syn.SpeakAsync($Text)
    $cancelAt = $null
    $lastAudibleMs = 0
    # Sample every ~50 ms across the window, interrupting partway through.
    for ($i = 0; $i -lt 120; $i++) {
      $ms = [math]::Round(((Get-Date) - $t0).TotalMilliseconds)
      if ($InterruptAfterMs -gt 0 -and $null -eq $cancelAt -and $ms -ge $InterruptAfterMs) {
        $syn.SpeakAsyncCancelAll()
        $cancelAt = $ms
      }
      # Drain any caption events raised since the last sample.
      foreach ($ev in @(Get-Event -SourceIdentifier "OcadeSpeakProgress" -ErrorAction SilentlyContinue)) {
        $args2 = $ev.SourceArgs[1]
        [void]$captions.Add([pscustomobject]@{
          ms = [math]::Round(($ev.TimeGenerated - $t0).TotalMilliseconds)
          charPosition = $args2.CharacterPosition
          word = [string]$args2.Text
        })
        Remove-Event -EventIdentifier $ev.EventIdentifier -ErrorAction SilentlyContinue
      }
      $p = [Meter]::Peak()
      $trace += [pscustomobject]@{ ms = $ms; peak = [math]::Round($p, 5) }
      if ($p -gt 0.002) { $lastAudibleMs = $ms }
      # Stop sampling once the reply has clearly ended.
      if ($null -ne $cancelAt -and $ms -gt $cancelAt + 900) { break }
      if ($null -eq $cancelAt -and $syn.State -eq [System.Speech.Synthesis.SynthesizerState]::Ready -and $ms -gt 500) { break }
      Start-Sleep -Milliseconds 50
    }
    Get-EventSubscriber -SourceIdentifier "OcadeSpeakProgress" -ErrorAction SilentlyContinue | Unregister-Event -Force
    $syn.Dispose()
    $after = @($trace | Where-Object { $null -ne $cancelAt -and $_.ms -gt $cancelAt + 250 })
    $peakAfterCut = if ($after.Count -gt 0) { ($after | Measure-Object -Property peak -Maximum).Maximum } else { $null }
    @{
      ok = $true
      interrupted = ($null -ne $cancelAt)
      cancelAtMs = $cancelAt
      lastAudibleMs = $lastAudibleMs
      # Peak output measured from 250 ms after the cut onwards. Anything still
      # playing would show here.
      peakAfterCut = $peakAfterCut
      maxPeakOverall = ($trace | Measure-Object -Property peak -Maximum).Maximum
      samples = $trace.Count
      trace = @($trace)
      captions = @($captions)
      captionCount = $captions.Count
    } | ConvertTo-Json -Depth 6 -Compress
  }

  "speak" {
    Add-Type -AssemblyName System.Speech
    $syn = New-Object System.Speech.Synthesis.SpeechSynthesizer
    if ($Voice) { $syn.SelectVoice($Voice) }
    $syn.SetOutputToDefaultAudioDevice()
    $started = Get-Date
    <#
      Interruption is proven by TIME, not by a returned flag.

      SpeakAsyncCancelAll returns immediately whether or not anything stopped,
      so trusting it would prove nothing. Instead the utterance is long enough
      that finishing it takes far longer than the interruption point, and the
      elapsed wall-clock time is reported: an interrupted reply must come back
      near the cut-off, not near the full duration.
    #>
    if ($InterruptAfterMs -gt 0) {
      [void]$syn.SpeakAsync($Text)
      Start-Sleep -Milliseconds $InterruptAfterMs
      $syn.SpeakAsyncCancelAll()
      $stoppedAt = Get-Date
      # Poll until the synthesiser reports it is no longer speaking.
      $settled = $false
      for ($i = 0; $i -lt 100; $i++) {
        if ($syn.State -eq [System.Speech.Synthesis.SynthesizerState]::Ready) { $settled = $true; break }
        Start-Sleep -Milliseconds 20
      }
      $done = Get-Date
      $syn.Dispose()
      @{
        ok = $true; interrupted = $true
        requestedInterruptMs = $InterruptAfterMs
        elapsedMs = [math]::Round(($done - $started).TotalMilliseconds)
        stopLatencyMs = [math]::Round(($done - $stoppedAt).TotalMilliseconds)
        synthesizerReturnedToReady = $settled
      } | ConvertTo-Json -Compress
    } else {
      $syn.Speak($Text)
      $done = Get-Date
      $syn.Dispose()
      @{ ok = $true; interrupted = $false; elapsedMs = [math]::Round(($done - $started).TotalMilliseconds) } | ConvertTo-Json -Compress
    }
  }

  "speak-and-capture" {
    <#
      A REAL acoustic round trip: speaker -> air -> microphone.

      No human is speaking here and the evidence says so plainly. What is real
      is everything the requirement is actually about: the microphone device is
      opened under permission, sound arrives through the air, and the recogniser
      is given nothing but the recorded waveform. Feeding the text straight to
      the recogniser would prove only that a string can be copied.
    #>
    $consent = Assert-MicPermission
    Add-Type -AssemblyName System.Speech
    $syn = New-Object System.Speech.Synthesis.SpeechSynthesizer
    if ($Voice) { $syn.SelectVoice($Voice) }
    $syn.SetOutputToDefaultAudioDevice()
    Start-Recording
    Start-Sleep -Milliseconds 600      # let the input settle before sound starts
    $syn.Speak($Text)
    Start-Sleep -Milliseconds 700      # capture the tail
    Stop-Recording $Path
    $syn.Dispose()
    $stats = Get-WavStats $Path
    $lines = Invoke-Stt $Path
    @{
      ok = $true; path = $Path; permission = $consent
      spokenText = $Text
      transcript = (($lines | ForEach-Object { $_.text }) -join " ")
      segments = @($lines)
      audio = $stats
      sha256 = (Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToLower()
    } | ConvertTo-Json -Depth 6 -Compress
  }
}
