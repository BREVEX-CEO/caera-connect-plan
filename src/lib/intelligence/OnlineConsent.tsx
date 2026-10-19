/**
 * ASKED ONCE, BEFORE ANYTHING IS SENT ONLINE (20261013091000).
 *
 * Online answers come from a third-party AI service on its free terms, which let it
 * keep and use what is sent. The Online boundary refuses an account that has not
 * agreed; the transport then asks here, records the answer, and sends the same
 * request again only on "I agree". Offline Chat never asks: it sends nothing.
 */
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/session";
import { useModalFocus } from "@/lib/use-modal-focus";
import { setOnlineConsentAsk } from "./online-consent-ask";
import { recordOnlineConsent } from "./online-consent.functions";

/*
 * EVERY ASKER IS ANSWERED (PLAN Phase 08 V16). Asks that arrive together share one question
 * (online-consent-ask.ts); this dialog also answers "no" when it goes away or the account
 * changes, so nothing waits for ever, and an agreement saved while another account signed
 * in is never handed to that account's request.
 */
export function OnlineConsentDialog() {
  const pending = useRef<((agreed: boolean) => void) | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const self = useRef<HTMLDivElement>(null);
  const { user } = useSession();
  const account = user?.id ?? null;
  const asked = useRef(account);
  useModalFocus(self, open);

  const settle = (agreed: boolean) => {
    pending.current?.(agreed);
    pending.current = null;
    setOpen(false);
    setSaving(false);
    setProblem(null);
  };

  useEffect(() => {
    const answered = pending;
    setOnlineConsentAsk(
      () =>
        new Promise<boolean>((resolve) => {
          answered.current = resolve;
          setOpen(true);
        }),
    );
    return () => {
      setOnlineConsentAsk(null);
      answered.current?.(false);
      answered.current = null;
    };
  }, []);

  // Another account signed in here: what the last one was asked is not this one's to answer.
  useEffect(() => {
    if (asked.current !== account) settle(false);
    asked.current = account;
  }, [account]);

  if (!open) return null;
  const answer = async (agreed: boolean) => {
    if (!agreed) return settle(false);
    const by = asked.current;
    setSaving(true);
    setProblem(null);
    try {
      await recordOnlineConsent({ data: { given: true } });
    } catch {
      setSaving(false);
      setProblem("That could not be saved. Nothing was sent; try again.");
      return;
    }
    settle(asked.current === by);
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4">
      <div
        ref={self}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="online-consent-title"
        aria-describedby="online-consent-body"
        className="glass-strong ocade-pop w-full max-w-md rounded-2xl p-5"
      >
        <h2 id="online-consent-title" className="text-base font-semibold text-foreground">
          Before OCADE answers online
        </h2>
        <div
          id="online-consent-body"
          className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground"
        >
          <p>
            Online answers and JARVIS send your messages through Cloudflare to Google’s AI service
            on its free terms. Google may keep what you send — your messages, files you attach, and
            pages or screens JARVIS reads — use it to improve its own products, and have people
            review it.
          </p>
          <p>
            Do not send passwords, payment details or confidential work. Offline Chat sends nothing
            off this device. You can withdraw this at any time in Settings, Privacy &amp; Security.
          </p>
        </div>
        {problem ? (
          <p role="status" className="mt-3 text-sm text-foreground">
            {problem}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void answer(false)}
            className="h-9 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Not now
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void answer(true)}
            className="h-9 rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
          >
            {saving ? "Saving…" : "I agree"}
          </button>
        </div>
      </div>
    </div>
  );
}
