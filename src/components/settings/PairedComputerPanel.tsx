import { useCallback, useEffect, useState } from "react";
import { Laptop, Link2, Link2Off, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PairedDesktopAdapter } from "@/lib/brain/adapters/paired-desktop";
import {
  pairedCredentials,
  savePairing,
  forgetPairing,
  hasPairing,
} from "@/lib/brain/paired-credentials";
import { TOKEN_LIFETIME_MS } from "@/lib/brain/pairing";
import { parsePairingCode } from "@/lib/brain/pairing-code";

/**
 * Pair this browser with a computer running OCADE.
 *
 * THE APPROVAL HAPPENS ON THE COMPUTER, NOT HERE. This screen accepts a code
 * that the desktop app displayed after a human approved the request there.
 * That direction matters: if a website could initiate a pairing that the
 * desktop accepted silently, visiting the wrong page would be enough to hand
 * over someone's engine. The desktop is the one that says yes.
 *
 * WHAT IS TYPED HERE IS NOT A PASSWORD. It is a one-time pairing code the
 * desktop generated and shows on its own screen. OCADE never asks for account
 * credentials on this page and there is no field that could take one.
 *
 * WHAT IS STORED. A device id, the computer's bridge address, and a shared
 * secret used ONLY to sign requests — it is never transmitted. "Forget" clears
 * it from this browser; revoking on the computer is separate and is what
 * actually stops this device being served.
 */

interface Connection {
  reachable: boolean;
  label?: string;
  detail: string;
}

export function PairedComputerPanel() {
  const [code, setCode] = useState("");
  const [paired, setPaired] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!hasPairing()) {
      setPaired(false);
      setConnection(null);
      return;
    }
    setPaired(true);
    setBusy("check");
    try {
      const adapter = new PairedDesktopAdapter({ credentials: pairedCredentials });
      const availability = await adapter.probe();
      setConnection(
        availability.available
          ? { reachable: true, label: availability.label, detail: "Answering now." }
          : { reachable: false, detail: availability.reason },
      );
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const connect = useCallback(async () => {
    const parsed = parsePairingCode(code);
    if (!parsed.ok) {
      toast.error(parsed.reason);
      return;
    }
    setBusy("connect");
    try {
      const stored = savePairing({
        deviceId: parsed.deviceId,
        bridgeUrl: parsed.bridgeUrl,
        secret: parsed.secret,
      });
      if (!stored) {
        toast.error("This browser refused to save the pairing.");
        return;
      }
      setCode("");
      await check();
      toast.success("Paired. OCADE will use that computer when it can reach it.");
    } finally {
      setBusy(null);
    }
  }, [code, check]);

  const forget = useCallback(async () => {
    forgetPairing();
    setPaired(false);
    setConnection(null);
    toast.success("This browser has forgotten the pairing.");
  }, []);

  return (
    <GlassPanel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Laptop className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-foreground">Paired computer</h2>
        </div>
        {paired ? (
          connection?.reachable ? (
            <StatusBadge status="connected">
              <ShieldCheck className="mr-1 inline h-3 w-3" />
              Reachable
            </StatusBadge>
          ) : (
            <StatusBadge status="paused">Not reachable</StatusBadge>
          )
        ) : (
          <StatusBadge status="setup_required">Not paired</StatusBadge>
        )}
      </div>

      <p className="mt-2 text-[13px] text-muted-foreground">
        Let this browser use the OCADE engine on a computer you own. Answers are generated there —
        on your hardware, not a company's — and nothing is sent to a third party.
      </p>

      {paired ? (
        <>
          <dl className="mt-4 grid gap-2 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Computer</dt>
              <dd className="text-foreground">{connection?.label ?? "Paired computer"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="text-foreground">{connection?.detail ?? "Checking…"}</dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void check()}
              disabled={busy !== null}
            >
              {busy === "check" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Check connection
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void forget()}
              disabled={busy !== null}
            >
              <Link2Off className="mr-2 h-4 w-4" />
              Forget on this browser
            </Button>
          </div>

          <div className="mt-3 flex gap-2 rounded-md border border-border/60 bg-card/40 p-3 text-[12px] text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <p>
              Forgetting removes the pairing from this browser only. To stop this device being
              served at all, revoke it on the computer itself — that is the change the computer
              enforces.
            </p>
          </div>
        </>
      ) : (
        <div className="mt-4 space-y-2">
          <Label htmlFor="ocade-pairing-code" className="text-[13px] text-foreground">
            Pairing code from your computer
          </Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="ocade-pairing-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste the code shown in OCADE on that computer"
              className="h-9 min-w-[16rem] flex-1 text-[13px]"
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              size="sm"
              onClick={() => void connect()}
              disabled={busy !== null || !code.trim()}
            >
              {busy === "connect" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              Pair
            </Button>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Open OCADE on the computer, approve this device there, and it will show you a code. The
            approval happens on that computer — a website cannot pair itself. This is not a password
            and OCADE will never ask for one here.
          </p>
        </div>
      )}

      <p className="mt-4 text-[12px] text-muted-foreground">
        Each request is signed and usable once, and expires after{" "}
        {Math.round(TOKEN_LIFETIME_MS / 1000)} seconds, so a captured one cannot be reused. The
        shared secret signs requests and is never sent anywhere.
      </p>
    </GlassPanel>
  );
}
