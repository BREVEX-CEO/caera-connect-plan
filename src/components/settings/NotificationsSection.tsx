import { useEffect, useState } from "react";
import { useSession } from "@/lib/session";
import { NOTIFICATION_CATEGORIES, isMutable } from "@/lib/notifications/categories";
import { availableChannels, deploymentChannelConfiguration } from "@/lib/notifications/channels";
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
import { Row } from "./rows";
import { cn } from "@/lib/utils";

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
  const channels = availableChannels(deploymentChannelConfiguration());
  const [recent, setRecent] = useState<NotificationRecord[]>([]);

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
          ? "Applied here for now — your account could not be reached."
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
            <span className="text-[13px] text-muted-foreground">Always on</span>
          )}
        </Row>
      ))}

      {channels.some((channel) => !channel.available) ? (
        <Row
          label="Where they can reach you"
          description={channels
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
              void markAllNotificationsRead().then(() =>
                setRecent((current) => current.map((entry) => ({ ...entry, readAt: "now" }))),
              )
            }
            className="h-8 rounded-md border border-border px-3 text-sm text-foreground transition-colors hover:bg-accent"
          >
            Mark all read
          </button>
        </Row>
      ) : null}

      {saved ? (
        <p className="pt-3 text-[13px] text-muted-foreground" role="status">
          {saved}
        </p>
      ) : null}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-10 rounded-full border border-border/60 transition-colors",
        checked ? "bg-primary" : "bg-secondary",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-background transition-[left]",
          checked ? "left-[1.15rem]" : "left-0.5",
        )}
      />
    </button>
  );
}
