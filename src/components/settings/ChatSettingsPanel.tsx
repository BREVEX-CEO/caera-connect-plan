import { MessageSquare, RotateCcw, AlertTriangle, Brain } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ReadOnlyBanner } from "./SettingsGate";
import { useSettingsAccess } from "./use-settings-access";
import {
  useChatPrefs,
  type EngineTierPreference,
  type SendKeyPreference,
  type MessageDensity,
} from "@/lib/use-chat-prefs";

/**
 * OCADE Chat settings.
 *
 * Every control here changes something the chat screen actually reads on its
 * next render — there is no "saved" state that nothing consumes. The engine
 * default in particular is the one that matters: it decides whether a new
 * conversation starts on the device or in the cloud, which is a privacy
 * decision as much as a performance one.
 *
 * These settings are stored in THIS BROWSER. That is stated on the page rather
 * than left to be discovered, because someone who sets "local only" here and
 * then opens OCADE on another machine is entitled to know it did not follow
 * them.
 */

/*
 * The third option was "OCADE Cloud — counts against your cloud allowance".
 * There is no cloud engine and no allowance to count against, so the option
 * described a purchase that cannot be made and a behaviour that cannot occur.
 *
 * The remaining two are kept apart because they mean different things to the
 * PERSON even though both now run on the device: "Automatic" is somebody who
 * has not thought about it, "On this device only" is somebody who has and
 * wants it stated back to them.
 */
const ENGINE_CHOICES: { value: EngineTierPreference; label: string; detail: string }[] = [
  {
    value: "auto",
    label: "Automatic",
    detail: "Lets OCADE choose how to answer. Either way it runs on this device.",
  },
  {
    value: "local",
    label: "On this device only",
    detail:
      "Never leaves the machine. Requests the device cannot serve are refused with a reason instead of being sent anywhere.",
  },
];

const SEND_CHOICES: { value: SendKeyPreference; label: string; detail: string }[] = [
  { value: "enter", label: "Enter sends", detail: "Shift+Enter starts a new line." },
  {
    value: "mod_enter",
    label: "Ctrl/Cmd+Enter sends",
    detail: "Enter starts a new line. Useful when you write long, multi-paragraph prompts.",
  },
];

const DENSITY_CHOICES: { value: MessageDensity; label: string }[] = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

export function ChatSettingsPanel() {
  const { prefs, update, reset, storageError } = useChatPrefs();
  const { canEdit } = useSettingsAccess();

  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Chat"
        description="How OCADE Chat behaves on this device: which engine new chats start on, how messages are sent, and how the transcript is shown."
        actions={
          <Button variant="outline" size="sm" onClick={reset} disabled={!canEdit}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to defaults
          </Button>
        }
      />

      <ReadOnlyBanner className="mb-5" linkToSignIn={false} />

      {storageError ? (
        <GlassPanel className="mb-5 flex gap-3 border-destructive/40 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="text-muted-foreground">{storageError}</p>
        </GlassPanel>
      ) : null}

      <div className="grid gap-5 pb-16">
        <GlassPanel className="p-5">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Engine for new chats</h2>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            You can still switch engine inside any individual conversation. This only sets where a
            new one begins.
          </p>
          <fieldset className="mt-4 grid gap-2">
            <legend className="sr-only">Engine for new chats</legend>
            {ENGINE_CHOICES.map((choice) => (
              <label
                key={choice.value}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-white/10 bg-white/[0.02] p-3 hover:bg-white/[0.05]"
              >
                <input
                  type="radio"
                  disabled={!canEdit}
                  name="ocade-default-engine"
                  className="mt-1"
                  value={choice.value}
                  checked={prefs.defaultEngineTier === choice.value}
                  onChange={() => update({ defaultEngineTier: choice.value })}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{choice.label}</span>
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">
                    {choice.detail}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        </GlassPanel>

        {/*
          Its own panel, above presentation, because this is the only control
          on the page that changes the ANSWER rather than how it is shown.
        */}
        <GlassPanel className="p-5">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Thinking</h2>
          </div>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label htmlFor="ocade-thinking" className="text-sm text-foreground">
                Think before answering
              </Label>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                OCADE works the question through before it replies. Better answers on anything with
                several steps to it, and roughly a third slower. Turn it off for short factual
                questions where you would rather have the reply now.
              </p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                This is Chat only. PC control never thinks first — there OCADE has to produce an
                action it can actually carry out, and thinking makes this model describe the action
                instead of doing it.
              </p>
            </div>
            <Switch
              id="ocade-thinking"
              disabled={!canEdit}
              checked={prefs.thinking}
              onCheckedChange={(v) => update({ thinking: v })}
            />
          </div>
        </GlassPanel>

        <GlassPanel className="p-5">
          <h2 className="text-sm font-semibold text-foreground">Sending messages</h2>
          <fieldset className="mt-3 grid gap-2">
            <legend className="sr-only">Send key</legend>
            {SEND_CHOICES.map((choice) => (
              <label
                key={choice.value}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-white/10 bg-white/[0.02] p-3 hover:bg-white/[0.05]"
              >
                <input
                  type="radio"
                  disabled={!canEdit}
                  name="ocade-send-key"
                  className="mt-1"
                  value={choice.value}
                  checked={prefs.sendKey === choice.value}
                  onChange={() => update({ sendKey: choice.value })}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{choice.label}</span>
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">
                    {choice.detail}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        </GlassPanel>

        <GlassPanel className="p-5">
          <h2 className="text-sm font-semibold text-foreground">Transcript</h2>
          <div className="mt-4 grid gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Label htmlFor="ocade-render-markdown" className="text-sm text-foreground">
                  Format replies
                </Label>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  Render headings, lists and code blocks. Turn off to read exactly what the model
                  produced, character for character.
                </p>
              </div>
              <Switch
                id="ocade-render-markdown"
                disabled={!canEdit}
                checked={prefs.renderMarkdown}
                onCheckedChange={(v) => update({ renderMarkdown: v })}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Label htmlFor="ocade-show-timestamps" className="text-sm text-foreground">
                  Show message times
                </Label>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  Adds the local time each message was recorded.
                </p>
              </div>
              <Switch
                id="ocade-show-timestamps"
                disabled={!canEdit}
                checked={prefs.showTimestamps}
                onCheckedChange={(v) => update({ showTimestamps: v })}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Label htmlFor="ocade-keep-drafts" className="text-sm text-foreground">
                  Keep unsent drafts
                </Label>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  Restores what you were typing when you return to a conversation. Turn off on a
                  shared computer so a closed tab discards it.
                </p>
              </div>
              <Switch
                id="ocade-keep-drafts"
                disabled={!canEdit}
                checked={prefs.keepDrafts}
                onCheckedChange={(v) => update({ keepDrafts: v })}
              />
            </div>

            <div>
              <span className="text-sm text-foreground">Density</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {DENSITY_CHOICES.map((choice) => (
                  <Button
                    key={choice.value}
                    type="button"
                    disabled={!canEdit}
                    size="sm"
                    variant={prefs.density === choice.value ? "default" : "outline"}
                    onClick={() => update({ density: choice.value })}
                    aria-pressed={prefs.density === choice.value}
                  >
                    {choice.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="p-5 text-[13px] text-muted-foreground">
          These preferences are stored in this browser only. They are not synced, and they contain
          no message content. Opening OCADE on another device gives that device its own settings.
        </GlassPanel>
      </div>
    </>
  );
}
