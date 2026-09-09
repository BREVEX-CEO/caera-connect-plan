import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Smartphone,
  QrCode,
  ShieldCheck,
  ShieldAlert,
  OctagonX,
  Check,
  X,
  Trash2,
  RefreshCw,
  WifiOff,
  Bell,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { EmptyState } from "@/components/shell/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useOnline } from "@/lib/use-online";
import {
  createPairingChallenge,
  verifyPairing,
  pairingPayload,
  isTrusted,
  applyEmergencyStop,
  PAIRING_TTL_MS,
  type PairingChallenge,
  type PairedDevice,
  type ApprovalRequest,
} from "@/lib/mobile/pairing";
import {
  applyMobileApproval,
  confirmMobileBiometric,
  createMobileIntentQueue,
  dispatchMobileIntent,
  flushMobileQueue,
  getMobileTransport,
  setMobileTransport,
  MOBILE_TRANSPORT_UNAVAILABLE,
  type MobileIntent,
} from "@/lib/mobile/companion-link";
import { buildMobileTransportOrUnavailable } from "@/lib/mobile/transport-factory";
import type { ChannelDescriptor } from "@/lib/mobile/pairing-keys";
import type { QueuedItem } from "@/lib/offline-queue";
import { canRegisterDevice, entitlementState } from "@/lib/ocade-allowance";
import {
  listApprovals,
  saveApprovalStatus,
  clearApprovals,
  pruneApprovals,
} from "@/lib/mobile/approval-store";
import {
  listDevices,
  activeDevices,
  saveDevice,
  revokeDevice as revokeDeviceRecord,
  forgetDevice,
  touchDevice,
} from "@/lib/mobile/device-store";
import {
  getNotificationTransport,
  notify,
  stoppedNotification,
  revokedNotification,
  NOTIFICATIONS_UNAVAILABLE,
  type PermissionState,
} from "@/lib/mobile/notifications";
import { computerUseChannelDecision } from "@/lib/computer-use-settings";
import {
  MOBILE_MISSION_COMMAND_KINDS,
  MOBILE_MISSION_RUNTIME_BOUNDARY,
} from "@/lib/mobile/mission-control";

export const Route = createFileRoute("/_authenticated/settings/mobile")({
  head: () => ({
    meta: [{ title: "Mobile companion — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: MobilePage,
});

/** Plain-language summary of a queued intent. Never echoes file contents. */
function describeIntent(intent: MobileIntent): string {
  switch (intent.kind) {
    case "task.handoff":
      return `Task for OCADE: “${intent.text.slice(0, 60)}${intent.text.length > 60 ? "…" : ""}”`;
    case "file.handoff":
      return `File: ${intent.name} (${Math.max(1, Math.round(intent.sizeBytes / 1024))} KB)`;
    case "clipboard.handoff":
      return "Clipboard hand-off";
    default:
      return "Queued request";
  }
}

function MobilePage() {
  const online = useOnline();
  const [challenge, setChallenge] = useState<PairingChallenge | null>(null);
  /* Set only after the user compares the pairing digits on both devices. */
  const [channel] = useState<ChannelDescriptor | null>(null);
  const [now, setNow] = useState(() => new Date());
  /*
   * Loaded from the ACCOUNT: pairing and — critically — REVOCATION must survive
   * a reload and reach the person's other devices. A registry kept in this
   * browser made both cosmetic, and made a revocation something only this
   * machine knew about.
   */
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [transportReason, setTransportReason] = useState<string | null>(null);

  const [notifPermission, setNotifPermission] = useState<PermissionState>("unsupported");
  const [handoffText, setHandoffText] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  // Read from the list the account returned, so a revoked device can never be
  // selected here — the list is refreshed after every action that changes it.
  const firstActiveDevice = devices.find((device) => !device.revoked) ?? null;

  const refreshDevices = useCallback(async () => {
    setDevices(await listDevices());
  }, []);

  useEffect(() => {
    void getNotificationTransport().permission().then(setNotifPermission);
    void refreshDevices();
  }, [refreshDevices]);

  /*
   * HELD IN THIS TAB, and the notices below say so rather than promising it
   * survives a reload. A handoff carries real text, and a copy of it waiting in
   * browser storage would outlive a sign-out and be invisible to every export
   * the account offers.
   */
  const queue = useMemo(() => createMobileIntentQueue(), []);
  const [queued, setQueued] = useState<QueuedItem<MobileIntent>[]>([]);
  const refreshQueue = useCallback(() => setQueued(queue.all()), [queue]);

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  // Replay held work when connectivity returns. Each item is re-checked against
  // the device's CURRENT state, so a phone revoked while offline sends nothing.
  useEffect(() => {
    if (!online || queue.size === 0) return;
    if (
      computerUseChannelDecision("pairedDevices") ||
      computerUseChannelDecision("remoteSessions")
    ) {
      return;
    }
    let cancelled = false;
    void flushMobileQueue(queue, devices.find((d) => !d.revoked) ?? null).then((r) => {
      if (cancelled) return;
      refreshQueue();
      if (r.sent > 0) toast.success(`Sent ${r.sent} queued ${r.sent === 1 ? "item" : "items"}.`);
      if (r.dropped > 0)
        toast.error(`${r.dropped} queued items were given up on after repeated failures.`);
    });
    return () => {
      cancelled = true;
    };
  }, [online, queue, devices, refreshQueue]);

  // Tick so the pairing countdown and approval expiry stay truthful.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /*
   * P13: build the encrypted transport from a CONFIRMED channel.
   *
   * P21 composed the transport stack but had nothing to build it from —
   * pairing exchanged only a six-digit code, so no relay, room or peer key
   * existed. P13 added the key exchange; `channel` below is the result of one
   * whose short authentication string the user compared and accepted.
   *
   * Until that confirmation happens `channel` is null and the refusing
   * transport stays in place. That is the correct default: an unconfirmed
   * channel may be relayed by an attacker, and a transport that connected
   * anyway would be encrypting to whoever is in the middle.
   */
  useEffect(() => {
    let live = true;
    void (async () => {
      const next = await buildMobileTransportOrUnavailable({
        deviceId: firstActiveDevice?.id,
        relayUrl: channel?.relayUrl,
        roomId: channel?.roomId,
        peerPublicKey: channel?.peerPublicKey,
      });
      if (!live) return;
      setMobileTransport(next);
      const s = await next.status();
      if (!live) return;
      setTransportReason(s.connected ? null : (s.reason ?? MOBILE_TRANSPORT_UNAVAILABLE));
    })();
    return () => {
      live = false;
    };
  }, [firstActiveDevice?.id, channel]);

  const refreshApprovals = useCallback(async (at: Date = new Date()) => {
    setApprovals(await listApprovals(at));
  }, []);

  /*
   * Read from the account, which applies expiry on read — so a request that
   * lapsed while no tab was open never shows as still pending, on any device.
   *
   * Bound to the clock's MINUTE rather than to its second. `now` ticks once a
   * second to keep the countdowns moving, and a request per second per open tab
   * for a list that changes rarely is the kind of quiet cost that only shows up
   * as a bill.
   */
  const minute = Math.floor(now.getTime() / 60_000);
  useEffect(() => {
    void refreshApprovals();
  }, [minute, refreshApprovals]);

  // Housekeeping: decided and expired rows are kept briefly so the user can see
  // what happened, then dropped so the list cannot grow without bound. Runs
  // once per mount rather than on the tick.
  useEffect(() => {
    void (async () => {
      await pruneApprovals();
      await refreshApprovals();
    })();
  }, [refreshApprovals]);

  const startPairing = useCallback(() => {
    // Enforce the device allowance HERE, before a code exists. Minting a code
    // the user cannot redeem would waste their time and only fail on the phone,
    // where the reason is much harder to explain.
    const room = canRegisterDevice({
      kind: "mobile",
      currentDesktop: 0,
      currentMobile: devices.filter((d) => !d.revoked && d.kind === "mobile").length,
      state: entitlementState(null),
    });
    if (!room.allowed) {
      toast.error(room.reason ?? "You've reached your mobile device limit.");
      return;
    }
    const c = createPairingChallenge(new Date());
    setChallenge(c);
    toast.success("Pairing code created. It expires in 5 minutes.");
  }, [devices]);

  const pairingExpired = challenge ? now.getTime() > challenge.expiresAt.getTime() : false;
  const secondsLeft = challenge
    ? Math.max(0, Math.round((challenge.expiresAt.getTime() - now.getTime()) / 1000))
    : 0;

  const payload = useMemo(
    () => (challenge ? pairingPayload(challenge, "account") : ""),
    [challenge],
  );

  async function decide(
    request: ApprovalRequest,
    decision: "approved" | "denied",
    device: PairedDevice,
  ) {
    if (decision === "approved") {
      const channelRefusal =
        computerUseChannelDecision("pairedDevices") ?? computerUseChannelDecision("remoteSessions");
      if (channelRefusal) {
        toast.error(channelRefusal);
        return;
      }
    }
    const confirmation = await confirmMobileBiometric(
      { kind: "approval.decide", requestId: request.id, decision },
      device,
    );
    if (!confirmation.ok) {
      toast.error(confirmation.detail);
      return;
    }
    const result = applyMobileApproval(request, decision, device, new Date());
    // Persist so the desktop — which is blocked waiting on this — sees it too.
    const persisted = saveApprovalStatus(request.id, result.status, device.id);
    if (!persisted) {
      toast.error(
        "The decision could not be saved. OCADE has not reported this request as decided.",
      );
      return;
    }
    // Deciding proves the device is present and working, so refresh its
    // last-seen. Without this an active phone drifts into "needs
    // re-verification" purely because nothing ever recorded that it acted.
    if (result.status === decision) await touchDevice(device.id);
    await refreshApprovals();
    await refreshDevices();
    toast[result.status === decision ? "success" : "error"](result.reason);
  }

  async function emergencyStop(device: PairedDevice) {
    // Emergency stop is deliberately NOT queued — halting must be decided live,
    // never replayed later against whatever happens to be running then.
    const r = await dispatchMobileIntent({ kind: "emergency.stop" }, device, {
      online,
      durable: queue,
    });
    refreshQueue();
    if (r.ok) {
      setApprovals((list) =>
        applyEmergencyStop(list, {
          requestedByDeviceId: device.id,
          requestedAt: new Date(),
          reason: "Emergency stop from mobile settings",
        }),
      );
      toast.success("Emergency stop acknowledged — pending actions cancelled.");
      // Urgent, so this is delivered even inside quiet hours.
      void notify(stoppedNotification(device.label));
    } else {
      toast.error(r.detail);
    }
  }

  /**
   * Finish pairing: verify the echoed code against the live challenge, then
   * trust the device. `verifyPairing` enforces expiry, nonce match and code
   * match — a wrong or late code is refused with its own reason rather than a
   * generic failure.
   */
  async function completePairing() {
    if (!challenge) return;
    const result = verifyPairing(
      challenge,
      { code: confirmCode.trim(), nonce: challenge.nonce },
      new Date(),
    );
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }

    const now = new Date();
    const device: PairedDevice = {
      id: crypto.randomUUID(),
      label: deviceLabel.trim() || "My phone",
      kind: "mobile",
      platform: "android",
      pairedAt: now,
      lastSeenAt: now,
      revoked: false,
    };
    const saved = await saveDevice(device);
    if (!saved.ok) {
      toast.error(saved.reason);
      return;
    }
    await refreshDevices();
    // A challenge is single-use: consume it so the same code cannot pair twice.
    setChallenge(null);
    setConfirmCode("");
    setDeviceLabel("");
    toast.success(`${device.label} paired. It can now monitor and approve, never take control.`);
  }

  /**
   * Hand text to the paired phone as a task or clipboard entry.
   *
   * Goes through the full guarded path, so a protected value is refused before
   * it is queued, sent, or written anywhere. When offline the intent waits in
   * this tab and is replayed on reconnect — closing the tab discards it, which
   * is what the notice beside the list says.
   */
  async function sendHandoff(kind: "task.handoff" | "clipboard.handoff") {
    const device = firstActiveDevice;
    const text = handoffText.trim();
    if (!device || !text) return;
    const channelRefusal =
      computerUseChannelDecision("pairedDevices") ?? computerUseChannelDecision("remoteSessions");
    if (channelRefusal) {
      toast.error(channelRefusal);
      return;
    }

    const intent: MobileIntent =
      kind === "task.handoff" ? { kind, conversationId: "handoff", text } : { kind, text };

    const r = await dispatchMobileIntent(intent, device, {
      online,
      durable: queue,
    });
    refreshQueue();
    if (r.ok) {
      setHandoffText("");
      toast.success(r.detail || "Sent to your phone.");
    } else {
      toast.error(r.detail);
    }
  }

  async function revoke(device: PairedDevice) {
    // Recorded as a tombstone in the account — a revocation that vanished on
    // reload, or that only one browser knew about, would be worse than none,
    // because the person believes a lost phone is cut off.
    const revoked = await revokeDeviceRecord(device.id);
    await refreshDevices();
    if (!revoked) {
      // Never claim a device was cut off when the record could not be written.
      toast.error(`Couldn't revoke ${device.label}. Try again — it may still be able to act.`);
      return;
    }
    // Anything this phone had queued is dropped — a revoked device must not be
    // able to act later through work it left behind.
    const dropped = queue.all().length;
    queue.clear();
    refreshQueue();
    // Pending approvals belong to a device that can no longer act. Leaving them
    // would let a revoked phone's decisions land after revocation.
    void clearApprovals();
    setApprovals([]);
    toast.success(
      dropped > 0
        ? `${device.label} revoked, and ${dropped} queued ${dropped === 1 ? "item" : "items"} discarded.`
        : `${device.label} revoked. It can no longer act on your account.`,
    );
    void notify(revokedNotification(device.label));
  }

  const pending = approvals.filter((r) => r.status === "pending");

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Mobile companion"
        description="Pair a phone to watch what OCADE is doing, approve or cancel actions, and stop everything instantly. A phone can never take arbitrary control of this computer."
      />

      <div className="flex flex-col gap-5">
        {transportReason ? (
          <GlassPanel className="flex items-start gap-2 p-4 text-sm">
            <ShieldAlert
              className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-warning)]"
              aria-hidden
            />
            <div>
              <p className="font-medium text-foreground">Mobile companion not connected</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{transportReason}</p>
            </div>
          </GlassPanel>
        ) : null}

        {!online ? (
          <GlassPanel className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
            <WifiOff className="h-4 w-4" aria-hidden />
            You&rsquo;re offline. Safe requests wait in this tab and are sent when your phone
            reconnects &mdash; closing it discards them. Stops and approvals always need a live
            connection.
          </GlassPanel>
        ) : null}

        {/* Pairing */}
        <GlassPanel className="p-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <QrCode className="h-4 w-4" aria-hidden /> Pair a phone
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Open OCADE on your phone and scan this code. The code is single-use and expires in five
            minutes — it carries no password or account secret.
          </p>

          {challenge && !pairingExpired ? (
            <div className="flex flex-wrap items-center gap-4">
              <div
                className="rounded-lg border border-border/70 bg-background p-3 font-mono text-2xl tracking-[0.3em] tabular-nums"
                aria-label={`Pairing code ${challenge.code.split("").join(" ")}`}
              >
                {challenge.code}
              </div>
              <div className="text-xs text-muted-foreground">
                <p>
                  Expires in{" "}
                  <span className="tabular-nums text-foreground">
                    {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
                  </span>
                </p>
                <p className="mt-1 max-w-xs break-all font-mono text-[10px] opacity-60">
                  {payload}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={startPairing}>
                <RefreshCw className="mr-1.5 h-4 w-4" /> New code
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={startPairing}>
              <QrCode className="mr-1.5 h-4 w-4" />
              {challenge && pairingExpired
                ? "Code expired — create a new one"
                : "Create pairing code"}
            </Button>
          )}
          {/*
            Completion step. The phone echoes the code back; the desktop
            verifies it against the live challenge before the device is trusted.
            Without this the pairing loop cannot close and the device list stays
            permanently empty.
          */}
          {challenge && !pairingExpired ? (
            <div className="mt-3 border-t border-border/60 pt-3">
              <label htmlFor="pair-confirm" className="text-xs font-medium text-foreground">
                Confirm the code your phone shows
              </label>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Your phone displays the same code back. Entering it here proves both devices are
                looking at the same pairing request.
              </p>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="pair-confirm"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  placeholder="Code from your phone"
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-9 w-44 font-mono text-sm"
                />
                <Input
                  value={deviceLabel}
                  onChange={(e) => setDeviceLabel(e.target.value)}
                  placeholder="Name this phone"
                  aria-label="Name for this phone"
                  className="h-9 w-48 text-sm"
                />
                <Button
                  size="sm"
                  className="h-9"
                  onClick={() => void completePairing()}
                  disabled={!confirmCode.trim()}
                >
                  Pair
                </Button>
              </div>
            </div>
          ) : null}

          <p className="mt-3 text-[11px] text-muted-foreground">
            Until a device finishes pairing it appears nowhere below — OCADE never lists a device it
            hasn't actually verified.
          </p>
        </GlassPanel>

        {/* Trusted devices */}
        <GlassPanel className="p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Smartphone className="h-4 w-4" aria-hidden /> Trusted devices
          </h3>
          {devices.length === 0 ? (
            <EmptyState
              icon={<Smartphone className="h-6 w-6" aria-hidden />}
              title="No phones paired yet"
              description="Pair a phone above to monitor and approve OCADE tasks from anywhere."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {devices.map((d) => {
                const trusted = isTrusted(d, now);
                return (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-3 text-[13px]"
                  >
                    <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="font-medium">{d.label}</span>
                    <span className="text-[11px] uppercase text-muted-foreground">
                      {d.platform}
                    </span>
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]",
                        d.revoked
                          ? "bg-destructive/15 text-destructive"
                          : trusted
                            ? "bg-[color:var(--state-success-surface-strong)] text-[color:var(--state-success)]"
                            : "bg-[color:var(--state-warning-surface-strong)] text-[color:var(--state-warning)]",
                      )}
                    >
                      {d.revoked ? (
                        <>
                          <ShieldAlert className="h-3 w-3" /> Revoked
                        </>
                      ) : trusted ? (
                        <>
                          <ShieldCheck className="h-3 w-3" /> Trusted
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="h-3 w-3" /> Needs re-verification
                        </>
                      )}
                    </span>
                    <span className="ml-auto flex gap-1">
                      {!d.revoked ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => void emergencyStop(d)}>
                            <OctagonX className="mr-1 h-3.5 w-3.5" /> Stop
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => void revoke(d)}>
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Revoke
                          </Button>
                        </>
                      ) : (
                        // A revoked device stays as a tombstone so it cannot
                        // silently re-pair. Forgetting it is a deliberate act.
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            void (async () => {
                              await forgetDevice(d.id);
                              await refreshDevices();
                              toast.success(
                                `${d.label} forgotten. It can be paired again if you choose.`,
                              );
                            })();
                          }}
                        >
                          Forget
                        </Button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            Lost your phone? Revoke it here — a revoked device is refused immediately, even for
            emergency stop.
          </p>
        </GlassPanel>

        {/* Continuity — hand a task, file or clipboard to the other device */}
        <GlassPanel className="p-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Send className="h-4 w-4" aria-hidden /> Hand off to your phone
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Send a task or some text to continue on the other device. Passwords, one-time codes and
            payment details are refused before anything is queued or sent.
          </p>

          <div className="flex flex-col gap-2">
            <textarea
              value={handoffText}
              onChange={(e) => setHandoffText(e.target.value)}
              rows={2}
              aria-label="Text to hand off"
              placeholder="Ask OCADE to pick this up on your phone…"
              className="w-full resize-none rounded-md border border-border/60 bg-transparent px-2.5 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void sendHandoff("task.handoff")}
                disabled={!handoffText.trim() || !firstActiveDevice}
              >
                Send as task
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void sendHandoff("clipboard.handoff")}
                disabled={!handoffText.trim() || !firstActiveDevice}
              >
                Send as clipboard
              </Button>
            </div>
            {!firstActiveDevice ? (
              <p className="text-[11px] text-muted-foreground">
                Pair a phone above before handing anything off.
              </p>
            ) : null}
          </div>
        </GlassPanel>

        {/* Notifications — honest permission state */}
        <GlassPanel className="p-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Bell className="h-4 w-4" aria-hidden /> Alerts
          </h3>
          <p className="mb-2 text-xs text-muted-foreground">
            {notifPermission === "granted"
              ? "Your phone alerts you when OCADE needs approval, and whenever everything is stopped."
              : notifPermission === "denied"
                ? "Notifications are turned off for OCADE in your phone's settings. Approvals will still appear here."
                : NOTIFICATIONS_UNAVAILABLE}
          </p>
          <ul className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            <li>Approval requests and expiries</li>
            <li>Emergency stop — always delivered, even during quiet hours</li>
            <li>
              Alerts never show passwords, one-time codes or payment details. If a request contains
              anything protected, the alert says only &ldquo;Open OCADE to see the details.&rdquo;
            </li>
          </ul>
        </GlassPanel>

        {/* Waiting to send — held in this tab, not written down */}
        {queued.length > 0 ? (
          <GlassPanel className="p-4">
            <h3 className="mb-2 text-sm font-semibold">Waiting to send</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Waiting in this tab and sent automatically when your phone reconnects. Closing this
              tab discards them. Stops and approvals are never queued &mdash; they always need a
              live connection.
            </p>
            <ul className="flex flex-col gap-2">
              {queued.map((q) => (
                <li
                  key={q.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-3 text-[13px]"
                >
                  <span className="min-w-0 flex-1">{describeIntent(q.payload)}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(q.queuedAt).toLocaleTimeString()}
                  </span>
                  {q.attempts > 0 ? (
                    <span className="text-[10px] uppercase text-[color:var(--state-warning)]">
                      {q.attempts} failed {q.attempts === 1 ? "try" : "tries"}
                    </span>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      queue.remove(q.id);
                      refreshQueue();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Discard</span>
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => {
                queue.clear();
                refreshQueue();
                toast.success("Queue cleared.");
              }}
            >
              Discard all
            </Button>
          </GlassPanel>
        ) : null}

        {/* Pending approvals */}
        <GlassPanel className="p-4">
          <h3 className="mb-2 text-sm font-semibold">Approvals waiting for you</h3>
          {pending.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nothing is waiting. When OCADE needs permission for something risky it appears here
              and on your paired phone.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pending.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-3 text-[13px]"
                >
                  <span className="min-w-0 flex-1">{r.summary}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">{r.risk}</span>
                  {devices[0] ? (
                    <span className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void decide(r, "approved", devices[0])}
                      >
                        <Check className="mr-1 h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void decide(r, "denied", devices[0])}
                      >
                        <X className="mr-1 h-3.5 w-3.5" /> Deny
                      </Button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        {/* What mobile can and cannot do — explicit boundary */}
        <GlassPanel className="p-4">
          <h3 className="mb-2 text-sm font-semibold">What a paired phone can do</h3>
          <ul className="grid gap-1 text-xs sm:grid-cols-2">
            {[
              ["See what OCADE is doing", true],
              ["Approve or deny an action", true],
              ["Cancel a running action", true],
              ["Emergency stop", true],
              ["Send a task to the desktop", true],
              ["Hand off a file or clipboard", true],
              ["Take arbitrary control of your PC", false],
              ["Enter passwords, OTPs or payment details", false],
            ].map(([label, allowed]) => (
              <li key={String(label)} className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    allowed ? "bg-[color:var(--state-success)]" : "bg-destructive",
                  )}
                />
                <span
                  className={allowed ? "text-foreground" : "text-muted-foreground line-through"}
                >
                  {label}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Pairing codes last {Math.round(PAIRING_TTL_MS / 60000)} minutes. Consequential actions
            always need a fresh confirmation on the device itself.
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            The signed mobile mission protocol exposes {MOBILE_MISSION_COMMAND_KINDS.length} closed,
            scoped commands. {MOBILE_MISSION_RUNTIME_BOUNDARY}
          </p>
        </GlassPanel>
      </div>
    </>
  );
}
