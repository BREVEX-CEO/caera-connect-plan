import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Mic, Volume2, Play, Square, ShieldAlert, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useVoicePrefs, listAudioDevices, type AudioDevice } from "@/lib/use-voice-prefs";
import { redactForSpeech } from "@/lib/voice/transcript-redaction";
import {
  toVoiceOptions,
  pickVoice,
  buildGreeting,
  detectVoiceCapabilities,
  supportedLanguages,
  languageStatus,
  DEFAULT_WAKE_PHRASES,
  type VoiceOption,
} from "@/lib/ocade-voice";

export const Route = createFileRoute("/_authenticated/settings/voice")({
  head: () => ({
    meta: [{ title: "OCADE Voice — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: VoiceSettingsPage,
});

function VoiceSettingsPage() {
  const { prefs, update, emergencyMute, storageError } = useVoicePrefs();
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [devices, setDevices] = useState<{ inputs: AudioDevice[]; outputs: AudioDevice[] }>({
    inputs: [],
    outputs: [],
  });
  const [speaking, setSpeaking] = useState(false);
  const caps =
    typeof window !== "undefined"
      ? detectVoiceCapabilities(window as unknown as { speechSynthesis?: unknown })
      : {
          synthesis: false,
          recognition: false,
          wakePhrase: false,
          wakeReason: "Wake phrase availability can only be checked in a browser.",
        };

  /**
   * @param announce - true when a person pressed "Refresh voices", false for
   *   the automatic loads on mount and on `voiceschanged`.
   *
   * A refresh that reports nothing is indistinguishable from a dead button.
   * The voice list is usually identical between two reads — the browser has
   * already loaded it — so pressing refresh changed no pixel and gave the user
   * no reason to believe the control existed. Worse, a browser with no speech
   * engine returned early and silently, which is precisely the case where an
   * explanation is owed.
   *
   * The automatic loads stay silent: nobody asked, so nobody needs telling.
   */
  const loadVoices = useCallback((announce = false) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      if (announce)
        toast.error("This browser has no speech engine, so there are no voices to list.");
      return;
    }
    const next = toVoiceOptions(window.speechSynthesis.getVoices());
    setVoices(next);
    if (!announce) return;
    if (next.length === 0) {
      toast.error("No voices found. The operating system may still be installing them.", {
        description: "Voices are provided by the system, not by OCADE.",
      });
      return;
    }
    toast.success(`${next.length} voice${next.length === 1 ? "" : "s"} available.`);
  }, []);

  useEffect(() => {
    loadVoices();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      // Wrapped, not passed directly: the handler receives an Event, which as a
      // positional argument would land in `announce` and be truthy — toasting
      // on every automatic reload the browser performs on its own.
      window.speechSynthesis.onvoiceschanged = () => loadVoices(false);
    }
    void listAudioDevices().then(setDevices);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [loadVoices]);

  async function requestMicrophone() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setDevices(await listAudioDevices());
      toast.success("Microphone allowed. Device names are now visible.");
    } catch {
      toast.error("Microphone access was denied. Push-to-talk needs it to hear you.");
    }
  }

  function speakSample() {
    if (!caps.synthesis) {
      toast.error("This browser has no speech engine, so OCADE can't speak here.");
      return;
    }
    if (prefs.muted) {
      toast.error("OCADE Voice is muted. Unmute to hear the sample.");
      return;
    }
    window.speechSynthesis.cancel();
    const greeting = buildGreeting(
      {
        style: prefs.addressStyle,
        preferredName: prefs.preferredName,
        customTitle: prefs.preferredTitle,
        enabled: prefs.greetingEnabled,
      },
      new Date().getHours(),
    );
    // Every text-to-speech surface goes through the one shared redactor — the
    // preview reads a user-supplied name/title back, so it is no exception.
    const u = new SpeechSynthesisUtterance(
      redactForSpeech(`${greeting} This is your OCADE voice.`).text,
    );
    const chosen = pickVoice(voices, { gender: prefs.gender, lang: prefs.language });
    if (chosen) {
      const match = window.speechSynthesis.getVoices().find((v) => v.name === chosen.name);
      if (match) u.voice = match;
    }
    u.rate = prefs.rate;
    u.pitch = prefs.pitch;
    u.lang = prefs.language;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }

  function stopSpeaking() {
    if (typeof window !== "undefined" && "speechSynthesis" in window)
      window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  const langs = supportedLanguages();

  // What the device actually asks for, and whether OCADE Voice can honour it.
  const deviceLanguage = typeof navigator !== "undefined" ? navigator.language : "";
  const deviceLanguageStatus = languageStatus(deviceLanguage);
  const deviceLanguageLabel = (() => {
    if (!deviceLanguage) return "";
    try {
      return (
        new Intl.DisplayNames([deviceLanguage], { type: "language" }).of(deviceLanguage) ??
        deviceLanguage
      );
    } catch {
      return deviceLanguage;
    }
  })();
  const genderVoices = (g: "male" | "female") =>
    voices.filter(
      (v) => v.gender === g && v.lang.toLowerCase().startsWith(prefs.language.slice(0, 2)),
    );

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="OCADE Voice"
        description="Speak to OCADE and hear replies. Voice uses the same conversations, memory and permissions as typed chat."
        actions={
          <Button variant="ghost" size="sm" onClick={emergencyMute}>
            <ShieldAlert className="mr-1.5 h-4 w-4" /> Emergency mute
          </Button>
        }
      />

      <div className="flex flex-col gap-5">
        {/* Capability honesty */}
        {!caps.synthesis || !caps.recognition ? (
          <GlassPanel className="p-4 text-sm">
            <p className="font-medium text-foreground">Limited voice support in this browser</p>
            <p className="mt-1 text-muted-foreground">
              {caps.recognition
                ? ""
                : "Speech recognition is unavailable, so push-to-talk won't work here. "}
              {caps.synthesis ? "" : "Speech output is unavailable, so OCADE can't speak here. "}
              Everything else on this page still saves.
            </p>
          </GlassPanel>
        ) : null}
        {storageError ? (
          <GlassPanel className="border-[color:var(--state-warning)]/50 p-4 text-sm">
            <p className="font-medium text-foreground">Voice settings were not saved</p>
            <p className="mt-1 text-muted-foreground">{storageError}</p>
          </GlassPanel>
        ) : null}

        {/* Voice choice — no assumed default */}
        <GlassPanel className="p-4">
          <h3 className="mb-1 text-sm font-semibold">Voice</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            OCADE has no default voice — choose the one you prefer.
          </p>
          <div className="flex flex-wrap gap-2">
            {(["female", "male"] as const).map((g) => {
              const available = genderVoices(g).length > 0;
              return (
                <button
                  key={g}
                  onClick={() => update({ gender: g, voiceName: genderVoices(g)[0]?.name ?? null })}
                  disabled={!available}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm capitalize transition-colors",
                    prefs.gender === g
                      ? "border-foreground/40 bg-sidebar-accent text-foreground"
                      : "border-border/70 text-muted-foreground hover:text-foreground",
                    !available && "cursor-not-allowed opacity-40",
                  )}
                  title={
                    available
                      ? `Use the ${g} voice`
                      : `No ${g} voice is installed for this language`
                  }
                >
                  OCADE {g}
                </button>
              );
            })}
            <Button variant="ghost" size="sm" onClick={() => loadVoices(true)}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh voices
            </Button>
          </div>
          {prefs.gender === "unknown" ? (
            <p className="mt-2 text-xs text-muted-foreground">No voice chosen yet.</p>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">
                Speed — {prefs.rate.toFixed(1)}×
              </span>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                value={prefs.rate}
                onChange={(e) => update({ rate: Number(e.target.value) })}
                className="h-6 w-full accent-[color:var(--foreground)]"
              />
            </label>
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">
                Pitch — {prefs.pitch.toFixed(1)}
              </span>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                value={prefs.pitch}
                onChange={(e) => update({ pitch: Number(e.target.value) })}
                className="h-6 w-full accent-[color:var(--foreground)]"
              />
            </label>
          </div>

          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={speakSample} disabled={!caps.synthesis}>
              <Play className="mr-1.5 h-4 w-4" /> Test voice
            </Button>
            {speaking ? (
              <Button size="sm" variant="ghost" onClick={stopSpeaking}>
                <Square className="mr-1.5 h-4 w-4" /> Stop
              </Button>
            ) : null}
          </div>
        </GlassPanel>

        {/* Language */}
        <GlassPanel className="p-4">
          <h3 className="mb-1 text-sm font-semibold">Language</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            A language appears here only when its speech input, output and wake phrase have been
            verified.
          </p>
          <div className="flex flex-wrap gap-2">
            {langs.map((l) => (
              <button
                aria-pressed={prefs.language === l.code}
                key={l.code}
                onClick={() => update({ language: l.code, voiceName: null })}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition-colors",
                  prefs.language === l.code
                    ? "border-foreground/40 bg-sidebar-accent text-foreground"
                    : "border-border/70 text-muted-foreground hover:text-foreground",
                )}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/*
            Without this, someone whose device language isn't verified sees a
            single option and no explanation for why their language is absent.
          */}
          {deviceLanguage && !deviceLanguageStatus.supported ? (
            <div className="mt-3 rounded-lg border border-border/60 bg-secondary/25 p-3">
              <p className="text-xs font-medium text-foreground">
                Your device is set to {deviceLanguageLabel}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{deviceLanguageStatus.reason}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                OCADE Voice will use {langs[0]?.label ?? "English"} instead. Typed chat is
                unaffected and works in your language.
              </p>
            </div>
          ) : null}
        </GlassPanel>

        {/* Input / output devices */}
        <GlassPanel className="p-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Mic className="h-4 w-4" aria-hidden /> Microphone and output
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Push-to-talk uses your browser's speech engine. Depending on the browser and operating
            system, microphone audio may be processed by an online speech service. OCADE does not
            store the audio.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">Microphone</span>
              <select
                value=""
                disabled
                className="h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm"
              >
                <option value="">System default (browser controlled)</option>
              </select>
            </label>
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">
                <Volume2 className="mr-1 inline h-3.5 w-3.5" aria-hidden /> Output
              </span>
              <select
                value=""
                disabled
                className="h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm"
              >
                <option value="">System default (browser controlled)</option>
              </select>
            </label>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Detected {devices.inputs.length} input and {devices.outputs.length} output device
            {devices.inputs.length + devices.outputs.length === 1 ? "" : "s"}. Web Speech does not
            provide a reliable API for routing recognition or synthesis to a selected device, so
            both use the browser/OS default.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => void requestMicrophone()}
          >
            Allow microphone
          </Button>
        </GlassPanel>

        {/* Wake phrase + captions */}
        <GlassPanel className="p-4">
          <h3 className="mb-1 text-sm font-semibold">Hands-free</h3>
          <label className="mt-2 flex min-h-[24px] items-start gap-2 py-1 text-sm">
            <input
              type="checkbox"
              checked={prefs.wakeEnabled}
              disabled={!caps.wakePhrase}
              onChange={(e) => update({ wakeEnabled: e.target.checked })}
              className="mt-1 h-4 w-4 accent-[color:var(--foreground)]"
            />
            <span>
              Enable the wake phrase
              <span className="block text-xs text-muted-foreground">
                {caps.wakePhrase
                  ? `Say “${DEFAULT_WAKE_PHRASES[0]}” or “${DEFAULT_WAKE_PHRASES[1]}”. This engine exposes local recognition. Off by default.`
                  : (caps.wakeReason ??
                    "Local wake-phrase recognition is unavailable in this browser.")}
              </span>
            </span>
          </label>
          <label className="mt-3 flex min-h-[24px] items-start gap-2 py-1 text-sm">
            <input
              type="checkbox"
              checked={prefs.captionsEnabled}
              onChange={(e) => update({ captionsEnabled: e.target.checked })}
              className="mt-1 h-4 w-4 accent-[color:var(--foreground)]"
            />
            <span>
              Show captions
              <span className="block text-xs text-muted-foreground">
                Display what OCADE hears and says.
              </span>
            </span>
          </label>
          <label className="mt-3 flex min-h-[24px] items-start gap-2 py-1 text-sm">
            <input
              type="checkbox"
              checked={prefs.autoSpeak}
              onChange={(e) => update({ autoSpeak: e.target.checked, muted: false })}
              className="mt-1 h-4 w-4 accent-[color:var(--foreground)]"
            />
            <span>
              Speak replies automatically
              <span className="block text-xs text-muted-foreground">
                You can always interrupt OCADE while it is speaking.
              </span>
            </span>
          </label>
          {prefs.muted ? (
            <p className="mt-3 rounded-md bg-[color:var(--state-warning)]/10 px-3 py-2 text-xs text-[color:var(--state-warning)]">
              Voice output is muted by emergency mute.{" "}
              <button className="underline" onClick={() => update({ muted: false })}>
                Unmute
              </button>
            </p>
          ) : null}
        </GlassPanel>

        {/* How OCADE addresses you */}
        <GlassPanel className="p-4">
          <h3 className="mb-1 text-sm font-semibold">How OCADE addresses you</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            OCADE never guesses a title from your name or voice — it uses exactly what you set here.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">Preferred name</span>
              <Input
                value={prefs.preferredName}
                onChange={(e) => update({ preferredName: e.target.value })}
                placeholder="e.g. Alex"
                className="h-9 text-sm"
              />
            </label>
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">Preferred title (optional)</span>
              <Input
                value={prefs.preferredTitle}
                onChange={(e) => update({ preferredTitle: e.target.value })}
                placeholder="Leave blank for no title"
                className="h-9 text-sm"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ["first_name", "First name"],
                ["full_name", "Full name"],
                ["custom_title", "Custom title"],
                ["none", "No name"],
              ] as const
            ).map(([value, label]) => (
              <button
                aria-pressed={prefs.addressStyle === value}
                key={value}
                onClick={() => update({ addressStyle: value })}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition-colors",
                  prefs.addressStyle === value
                    ? "border-foreground/40 bg-sidebar-accent text-foreground"
                    : "border-border/70 text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="mt-3 flex min-h-[24px] items-center gap-2 py-1 text-sm">
            <input
              type="checkbox"
              checked={prefs.greetingEnabled}
              onChange={(e) => update({ greetingEnabled: e.target.checked })}
              className="h-4 w-4 accent-[color:var(--foreground)]"
            />
            Greet me when a voice session starts
          </label>
          <p className="mt-3 rounded-md bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
            Preview:{" "}
            <span className="text-foreground">
              {buildGreeting(
                {
                  style: prefs.addressStyle,
                  preferredName: prefs.preferredName,
                  customTitle: prefs.preferredTitle,
                  enabled: prefs.greetingEnabled,
                },
                new Date().getHours(),
              ) || "(no greeting)"}
            </span>
          </p>
        </GlassPanel>
      </div>
    </>
  );
}
