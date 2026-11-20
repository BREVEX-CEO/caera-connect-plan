import { getChatHook, removeChatHook, saveChatHook } from "@/lib/notifications/chat.functions";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/session";
import { NOTIFICATION_CATEGORIES, isMutable } from "@/lib/notifications/categories";
import { deploymentChannelConfiguration, resolveChannels } from "@/lib/notifications/channels";
import {
  pushDeviceState,
  turnPushOff,
  turnPushOn,
  type PushDeviceState,
} from "@/lib/notifications/push-device";
import { defaultPreferences, type NotificationPreferences } from "@/lib/notifications/preferences";
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
} from "@/lib/notifications/preference-sync";
import { supabasePreferenceBackend } from "@/lib/notifications/supabase-backend";
import {
  listNotifications,
  markAllNotificationsRead,
  type NotificationRecord,
} from "@/lib/notifications/history";
import { Row, Toggle } from "./rows";

/**
 * NOTIFICATIONS, AND AN HONEST ANSWER ABOUT WHETHER A CHOICE GOT THERE.
 *
 * The rules were built and tested and had no screen: `preference-sync.ts`
 * carefully distinguishes "saved", "applies on this device for now" and
 * "refused", and nothing had ever shown a person any of the three.
 *
 * WHAT IS NOT OFFERED. Security, account recovery and billing cannot be muted,
 * so they are listed as always on rather than as a switch that snaps back. A
 * channel the deployment has not configured is shown with the reason instead of
 * a toggle that would do nothing.
 */
export function NotificationsSection() {
  const { user } = useSession();
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences());
  const [source, setSource] = useState<"account" | "defaults">("defaults");
  const [saved, setSaved] = useState<string | null>(null);
  const allChannels = resolveChannels(deploymentChannelConfiguration());
  const channels = allChannels.filter((channel) => channel.available);
  const [recent, setRecent] = useState<NotificationRecord[]>([]);
  const [device, setDevice] = useState<PushDeviceState | null>(null);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [deviceProblem, setDeviceProblem] = useState<string | null>(null);
  useEffect(() => {
    void pushDeviceState().then(setDevice, () => setDevice("unsupported"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const backend = supabasePreferenceBackend(user?.id ?? null);
    void loadNotificationPreferences({
      backend,
      availableChannelIds: channels.map((channel) => channel.id),
    }).then((loaded) => {
      if (cancelled) return;
      setPreferences(loaded.preferences);
      setSource(loaded.source);
    });
    /*
     * AND WHAT WAS ACTUALLY SENT. A protected category is recorded even when
     * there is nowhere to deliver it, so without this list those records exist
     * and nobody can read them — which makes "security alerts always reach you"
     * untrue in the one case it was written for.
     */
    void listNotifications().then((outcome) => {
      if (!cancelled && outcome.ok) setRecent(outcome.value.slice(0, 10));
    });

    return () => {
      cancelled = true;
    };
    // Channels come from the deployment and never change within a session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function apply(next: NotificationPreferences) {
    setPreferences(next);
    const outcome = await saveNotificationPreferences({
      backend: supabasePreferenceBackend(user?.id ?? null),
      preferences: next,
    });
    setSaved(
      outcome.state === "saved"
        ? "Saved to your account."
        : outcome.state === "session_only"
          ? `Not saved: ${outcome.reason}`
          : `Not saved: ${outcome.reason}`,
    );
  }

  return (
    <div>
      <Row
        label="Optional notifications"
        description={
          source === "defaults"
            ? "These are the defaults. Your own choices load when your account answers."
            : "Security, account recovery and billing always reach you, whatever this says."
        }
      >
        <Toggle
          checked={!preferences.muteOptional}
          label="Optional notifications"
          onChange={(next) => void apply({ ...preferences, muteOptional: !next })}
        />
      </Row>

      <Row
        label="Quiet hours"
        description={
          preferences.quietHours.enabled
            ? `Held between ${preferences.quietHours.fromHour}:00 and ${preferences.quietHours.toHour}:00 in your own time zone.`
            : "Optional notifications arrive whenever they happen."
        }
      >
        <Toggle
          checked={preferences.quietHours.enabled}
          label="Quiet hours"
          onChange={(next) =>
            void apply({
              ...preferences,
              quietHours: { ...preferences.quietHours, enabled: next },
            })
          }
        />
      </Row>

      {NOTIFICATION_CATEGORIES.map((category) => (
        <Row key={category.id} label={category.title} description={category.description}>
          {isMutable(category.id) ? (
            <Toggle
              checked={preferences.categories[category.id].channels.length > 0}
              label={category.title}
              onChange={(next) =>
                void apply({
                  ...preferences,
                  categories: {
                    ...preferences.categories,
                    [category.id]: {
                      ...preferences.categories[category.id],
                      channels: next ? ["in_app"] : [],
                    },
                  },
                })
              }
            />
          ) : (
            <span className="text-[0.8125rem] text-muted-foreground">Always on</span>
          )}
        </Row>
      ))}

      <ChatApp />

      {device && device !== "unsupported" ? (
        <Row
          label="On this device"
          description={
            deviceProblem ??
            (device === "needs_home_screen"
              ? "On iPhone and iPad, Apple shows a website's notifications only when it is opened from the Home Screen."
              : device === "denied"
                ? "This browser was told not to show OCADE's notifications. Allow them in the browser's site settings, then come back."
                : device === "on"
                  ? "This browser shows the kinds that are on, even when OCADE is closed."
                  : "Show the kinds that are on here, even when OCADE is closed.")
          }
        >
          {device === "on" || device === "off" ? (
            <Toggle
              checked={device === "on"}
              disabled={deviceBusy}
              label="Notifications on this device"
              onChange={(next) => {
                setDeviceBusy(true);
                setDeviceProblem(null);
                void (next ? turnPushOn() : turnPushOff())
                  .then(setDevice, (cause: unknown) =>
                    setDeviceProblem(cause instanceof Error ? cause.message : String(cause)),
                  )
                  .finally(() => setDeviceBusy(false));
              }}
            />
          ) : null}
        </Row>
      ) : null}

      {allChannels.some((channel) => !channel.available) ? (
        <Row
          label="Where they can reach you"
          description={allChannels
            .filter((channel) => !channel.available)
            .map((channel) => channel.unavailableReason)
            .join(" ")}
        />
      ) : null}

      {recent.length > 0 ? (
        <Row
          label="Recent"
          description={
            <ul className="space-y-1">
              {recent.map((notification) => (
                <li key={notification.id}>{notification.title}</li>
              ))}
            </ul>
          }
        >
          <button
            type="button"
            onClick={() =>
              void markAllNotificationsRead().then((outcome) =>
                outcome.ok
                  ? setRecent((current) => current.map((entry) => ({ ...entry, readAt: "now" })))
                  : setSaved(`Not marked read: ${outcome.message}`),
              )
            }
            className="h-8 rounded-md border border-border px-3 text-sm text-foreground transition-colors hover:bg-accent"
          >
            Mark all read
          </button>
        </Row>
      ) : null}

      {saved ? (
        <p className="pt-3 text-[0.8125rem] text-muted-foreground" role="status">
          {saved}
        </p>
      ) : null}
    </div>
  );
}

/** Notifications in the person's own chat app (REPO-20): notification only, never approval. */
function ChatApp() {
  const [kind, setKind] = useState<string | null | undefined>(undefined);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    void getChatHook().then(
      (hook) => setKind(hook.kind),
      () => setKind(null),
    );
  }, []);
  const names: Record<string, string> = {
    slack: "Slack",
    discord: "Discord",
    teams: "Microsoft Teams",
    ntfy: "ntfy",
  };
  return (
    <Row
      label="Chat app"
      description={
        message ??
        (kind
          ? `Notifications that are on also go to your ${names[kind] ?? kind} channel. It only tells you; nothing there can approve or start anything.`
          : "Also send the notifications that are on to a Slack, Discord, Microsoft Teams or ntfy channel: paste its incoming-webhook address.")
      }
    >
      {kind ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void removeChatHook()
              .then(() => {
                setKind(null);
                setMessage(null);
              })
              .catch((error: Error) => setMessage(error.message))
              .finally(() => setBusy(false));
          }}
          className="rounded-full border border-border px-3 py-1 text-xs hover:bg-accent"
        >
          Disconnect
        </button>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            void saveChatHook({ data: { url: address } })
              .then((saved) => {
                setKind(saved.kind);
                setAddress("");
                setMessage(
                  saved.test === "sent"
                    ? "Connected. A test message was sent there."
                    : "Saved, but the test message did not arrive. Check the address.",
                );
              })
              .catch((error: Error) => setMessage(error.message))
              .finally(() => setBusy(false));
          }}
        >
          <input
            type="url"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            aria-label="Incoming-webhook address"
            placeholder="https://hooks.slack.com/services/…"
            className="w-56 rounded-md border border-border bg-background px-2 py-1 text-xs"
          />
          <button
            type="submit"
            disabled={busy || !address.trim()}
            className="rounded-full border border-border px-3 py-1 text-xs hover:bg-accent disabled:opacity-50"
          >
            Connect
          </button>
        </form>
      )}
    </Row>
  );
}
