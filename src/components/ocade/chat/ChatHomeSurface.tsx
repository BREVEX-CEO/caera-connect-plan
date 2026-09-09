import { useEffect, useRef, useState } from "react";
import { EyeOff, Send } from "lucide-react";
import { toast } from "sonner";
import { INCOGNITO_SUMMARY } from "@/lib/chat/incognito";
import { capabilityLabelFor } from "@/lib/ocade-capability-labels";
import { ocadeChatCapabilityDisclosure } from "@/lib/ocade-identity";
import { getOcadeModel } from "@/lib/ocade-models";
import { useDictation } from "@/lib/voice/use-dictation";
import { Composer } from "./ChatComposer";
import type { Attachment, PermissionMode } from "./conversation-model";

/**
 * Chat with nothing in it yet.
 *
 * The empty state is a real surface rather than a placeholder: it carries the
 * same composer the open conversation uses, so the first message is written in
 * the control the person will keep using. Extracted from the Chat route by
 * `PLAN.md` Phase 1; behaviour is unchanged.
 */
export function HomeSurface(props: {
  userLabel: string;
  model: string;
  setModel: (m: string) => void;
  chatsMode: "browser_only" | "pc_vault" | "private_sync";
  permission: PermissionMode;
  setPermission: (p: PermissionMode) => void;
  /** Whether the conversation this composer starts will be incognito — §8. */
  incognito: boolean;
  setIncognito: (next: boolean) => void;
  onSubmit: (text: string, atts: Attachment[]) => Promise<void>;
}) {
  const {
    userLabel,
    model,
    setModel,
    chatsMode,
    permission,
    setPermission,
    incognito,
    setIncognito,
    onSubmit,
  } = props;
  const modelInfo = getOcadeModel(model);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);

  /*
   * THE MICROPHONE BELONGS ON THE FIRST SCREEN TOO.
   *
   * This surface is what every new account sees, and it was the one composer
   * in the product with no voice control at all — the conversation view had
   * one, Control + Work had one, the demo had one, and the screen a person
   * actually starts on did not. Someone who signed up to dictate found the
   * feature only by typing a message first, which is the opposite of the
   * order they would try it in.
   *
   * `useDictation` rather than a second copy of the recogniser wiring: it
   * already names every failure separately (denied, no microphone, recogniser
   * unreachable), keeps interim text flowing so the button never looks stuck,
   * and deliberately does not auto-send.
   */
  const dictation = useDictation({
    lang: "en-US",
    onTranscript: (text, isFinal) => {
      if (isFinal) setDraft((current) => `${current} ${text}`.trim());
    },
  });

  /*
   * SAY WHAT WENT WRONG, RATHER THAN RETURNING IT TO NOBODY.
   *
   * `useDictation` names every failure separately — a denied microphone, no
   * microphone at all, a recogniser it could not reach — and hands the sentence
   * back as `error`. The button that usually renders it is `DictateButton`,
   * which puts it in a tooltip; this composer draws its own microphone and had
   * nowhere to put it. So the hook did the hard part and the result was
   * discarded: pressing the microphone lit it for an instant and it went out,
   * with nothing to read anywhere on the page.
   */
  const lastVoiceError = useRef<string | null>(null);
  useEffect(() => {
    if (!dictation.error || dictation.error === lastVoiceError.current) return;
    lastVoiceError.current = dictation.error;
    toast.error(dictation.error);
  }, [dictation.error]);

  async function submit() {
    const text = draft.trim();
    if (!text && attachments.length === 0) return;
    if (busy) return;
    setBusy(true);
    try {
      await onSubmit(text, attachments);
      setDraft("");
      setAttachments([]);
    } catch (e) {
      toast.error((e as Error).message || "Could not start conversation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col justify-center px-6 py-10">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-md border border-border/70 text-[color:var(--accent-ocade)]"
            aria-hidden
          >
            <span className="text-[15px] font-semibold tracking-tighter">CC</span>
          </div>
          <div>
            <h1 className="text-[22px] font-semibold text-foreground">Welcome, {userLabel}.</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              OCADE by CARCC CADANE. Ask a question or start a task.
            </p>
          </div>
        </div>

        <Composer
          draft={draft}
          setDraft={setDraft}
          attachments={attachments}
          setAttachments={setAttachments}
          onSubmit={submit}
          // No onStop: creating a conversation is a single round trip with
          // nothing to cancel, so no Stop button is offered. Send disables
          // itself while the request is in flight.
          streaming={busy}
          permission={permission}
          setPermission={setPermission}
          model={model}
          setModel={setModel}
          chatsMode={chatsMode}
          onToggleVoice={dictation.toggle}
          listening={dictation.state === "listening" || dictation.state === "hearing"}
          floating
        />

        {/*
          PLAN.md §8's incognito conversation, offered where a conversation
          starts — which is the only moment the choice can be made. A
          conversation cannot change its mind halfway through without either
          unwriting what came before or writing what did not, and both are
          worse than the restriction.
        */}
        <div className="mt-3 flex justify-center">
          <label
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border/60 px-3 py-1.5 text-[13px] text-foreground"
            htmlFor="start-incognito"
          >
            <input
              id="start-incognito"
              type="checkbox"
              className="h-6 w-6 rounded border-input"
              checked={incognito}
              onChange={(event) => setIncognito(event.target.checked)}
            />
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            Start this one incognito
          </label>
        </div>
        {incognito ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">{INCOGNITO_SUMMARY}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setDraft(s)}
              className="rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-[12px] text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>

        {/*
          Measured to 70ch and re-centred with it. This disclosure is the one
          sentence on the empty chat screen that a person actually has to read,
          and at 1440 it was set across 772px — a hundred and forty characters,
          where the eye starts losing the return sweep. `mx-auto` because the
          width bound would otherwise pull the centred line to the left.
        */}
        <p className="mx-auto mt-6 max-w-[70ch] text-center text-[11px] text-muted-foreground/80">
          {ocadeChatCapabilityDisclosure(capabilityLabelFor({ locality: modelInfo.locality }))}
        </p>
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "Summarize this document",
  "Draft a professional email",
  "Explain a concept simply",
  "Plan my next work session",
];
