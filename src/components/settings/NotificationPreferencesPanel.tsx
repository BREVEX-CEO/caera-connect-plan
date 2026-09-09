import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellOff, Check, Loader2, Moon } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategoryId,
  type NotificationFrequency,
} from "@/lib/notifications/categories";
import {
  deploymentChannelConfiguration,
  resolveChannels,
  type NotificationChannelId,
} from "@/lib/notifications/channels";
import {
  defaultPreferences,
  normalisePreferences,
  type NotificationPreferences,
} from "@/lib/notifications/preferences";
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
  type SaveOutcome,
} from "@/lib/notifications/preference-sync";
import { supabasePreferenceBackend } from "@/lib/notifications/supabase-backend";
import { useSession } from "@/lib/session";
import { getNotificationTransport, type PermissionState } from "@/lib/mobile/notifications";

/**
 * NOTIFICATION PREFERENCES, PLAN.md §D.
 *
 * THE PART THAT IS EASY AND THE PART THAT IS NOT. Rendering ten categories
 * against five channels is easy. What §D actually asks for is that the screen
 * never offers a control that does nothing:
 *
 *   A channel this deployment has not configured is shown as UNAVAILABLE with
 *   the reason, not as a toggle that silently fails. §D: "If a channel is
 *   unconfigured, hide its enable control or show an exact unavailable state."
 *
 *   Security, account-recovery and billing have no mute and no quiet-hours
 *   escape, because the resolver would ignore one anyway. A toggle whose value
 *   is discarded is worse than no toggle: it is a promise the product breaks
 *   silently.
 *
 *   Browser permission is asked for only after the person has said they want
 *   it, and a refusal is a state this screen can show rather than a dead end.
 *   §D: "Push pre-permission explanation. Explicit decline. Enable-later path."
 *
 * WHERE THESE ARE KEPT, SAID PLAINLY ON THE SCREEN. The account, and only the
 * account — §D asks for cross-device synchronisation, and a signed-in person's
 * choices follow them. Nothing is written to this browser: the cache that used
 * to be here survived sign-out, so the next person to use the machine saw the
 * previous person's quiet hours until the account answered.
 *
 * Until it answers, the screen shows the DEFAULTS and says they are defaults.
 * Showing them as though somebody had chosen them is how a muted category
 * appears to be switched on.
 *
 * THE SAVE STATE IS REPORTED, NOT ASSUMED. "Saved" means the account
 * acknowledged it. Session-only means OCADE could not reach the account and the
 * choice holds until the tab closes — which matters, because it means the phone
 * has not heard about it and neither will this browser after a reload. A
 * refusal is shown as a failure. `preference-sync.ts` decides which of the
 * three happened; this screen only renders it.
 */
export function NotificationPreferencesPanel() {
  const channels = useMemo(() => resolveChannels(deploymentChannelConfiguration()), []);
  const availableIds = useMemo(
    () => channels.filter((channel) => channel.available).map((channel) => channel.id),
    [channels],
  );

  const { user } = useSession();
  const backend = useMemo(() => supabasePreferenceBackend(user?.id ?? null), [user?.id]);

  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveState, setSaveState] = useState<SaveOutcome | null>(null);
  const [source, setSource] = useState<"account" | "defaults">("defaults");
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    /*
     * After mount. Nothing is read from the browser: preferences live in the
     * account, and until it answers this screen shows the defaults and says so
     * rather than showing a previous signed-in person's settings.
     */
    setLoaded(true);
    void getNotificationTransport()
      .permission()
      .then(setPermission)
      .catch(() => setPermission("unsupported"));
  }, [availableIds]);

  /*
   * The account's copy, once there is an account. It is the only copy: an
   * account with no row yet has never had a preference changed, and is shown
   * the defaults it is genuinely being treated with.
   */
  useEffect(() => {
    let cancelled = false;
    void loadNotificationPreferences({ backend, availableChannelIds: availableIds }).then(
      (loadedPreferences) => {
        if (cancelled) return;
        setPreferences(loadedPreferences.preferences);
        setSource(loadedPreferences.source);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [backend, availableIds]);

  const update = useCallback(
    (next: NotificationPreferences) => {
      setPreferences(next);
      if (!loaded) return;
      void saveNotificationPreferences({ preferences: next, backend }).then((outcome) => {
        setSaveState(outcome);
        if (outcome.state !== "saved") return;
        setSource("account");
        setSaved(true);
        // Confirmation that fades, because it confirms an action rather than
        // describing a state. A permanent "Saved" says nothing after a minute.
        window.setTimeout(() => setSaved(false), 2200);
      });
    },
    [backend, loaded],
  );

  const toggleChannel = (categoryId: NotificationCategoryId, channelId: NotificationChannelId) => {
    const category = preferences.categories[categoryId];
    const has = category.channels.includes(channelId);
    const channelsNext = has
      ? category.channels.filter((entry) => entry !== channelId)
      : [...category.channels, channelId];
    update(
      normalisePreferences(
        {
          ...preferences,
          categories: {
            ...preferences.categories,
            [categoryId]: { ...category, channels: channelsNext },
          },
        },
        availableIds,
      ),
    );
  };

  const setFrequency = (categoryId: NotificationCategoryId, frequency: NotificationFrequency) => {
    const category = preferences.categories[categoryId];
    update(
      normalisePreferences(
        {
          ...preferences,
          categories: {
            ...preferences.categories,
            [categoryId]: { ...category, frequency },
          },
        },
        availableIds,
      ),
    );
  };

  async function askForBrowserPermission() {
    setAsking(true);
    try {
      setPermission(await getNotificationTransport().request());
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <GlassPanel className="flex flex-col gap-3 p-5">
        <header className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
          {saved ? (
            <span
              role="status"
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground"
            >
              <Check className="h-3.5 w-3.5" aria-hidden /> Saved to your account
            </span>
          ) : null}
        </header>
        <p className="text-[13px] leading-6 text-muted-foreground">
          Choose what OCADE tells you about, and where.{" "}
          {source === "account"
            ? "These follow your account, so a change here reaches your other devices."
            : backend
              ? "OCADE has not been able to read these from your account yet, so what you see are the defaults."
              : "You are not signed in, so these apply until you close this tab."}
        </p>

        {/*
          THE ONE THING A PERSON CANNOT SEE FOR THEMSELVES: whether the change
          they just made reached the account. A screen that says "Saved" for
          both outcomes is how somebody sets quiet hours on a laptop and is
          woken by a phone that never heard about it.
        */}
        {saveState && saveState.state !== "saved" ? (
          <p
            role="status"
            className={
              saveState.state === "failed"
                ? "rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                : "rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground"
            }
          >
            {saveState.state === "failed"
              ? `Your account refused this change: ${saveState.reason}`
              : saveState.reason}
          </p>
        ) : null}

        <div className="rounded-xl border border-border/60 p-3">
          <label className="flex items-start gap-2 text-[13px]">
            <input
              type="checkbox"
              className="mt-1"
              checked={preferences.muteOptional}
              onChange={(event) => update({ ...preferences, muteOptional: event.target.checked })}
            />
            <span>
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <BellOff className="h-3.5 w-3.5" aria-hidden />
                Mute optional notifications
              </span>
              <span className="mt-0.5 block text-muted-foreground">
                Security, account recovery and billing are never muted. Silencing those would hide
                exactly the events you would want to know about, so OCADE does not offer it.
              </span>
            </span>
          </label>
        </div>

        <div className="rounded-xl border border-border/60 p-3">
          <label className="flex items-start gap-2 text-[13px]">
            <input
              type="checkbox"
              className="mt-1"
              checked={preferences.quietHours.enabled}
              onChange={(event) =>
                update({
                  ...preferences,
                  quietHours: { ...preferences.quietHours, enabled: event.target.checked },
                })
              }
            />
            <span className="flex-1">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Moon className="h-3.5 w-3.5" aria-hidden />
                Quiet hours
              </span>
              <span className="mt-0.5 block text-muted-foreground">
                Optional notifications are held until the window ends. Measured in the time zone you
                choose, not this device&rsquo;s — so it still means night when you travel.
              </span>
            </span>
          </label>
          {preferences.quietHours.enabled ? (
            <div className="mt-2 flex flex-wrap items-end gap-3 text-xs">
              <label className="text-muted-foreground">
                From
                <select
                  value={preferences.quietHours.fromHour}
                  onChange={(event) =>
                    update({
                      ...preferences,
                      quietHours: {
                        ...preferences.quietHours,
                        fromHour: Number(event.target.value),
                      },
                    })
                  }
                  className="ml-2 min-h-9 rounded-md border border-border/70 bg-background px-2 text-foreground"
                >
                  {HOURS.map((hour) => (
                    <option key={hour} value={hour}>
                      {String(hour).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-muted-foreground">
                Until
                <select
                  value={preferences.quietHours.toHour}
                  onChange={(event) =>
                    update({
                      ...preferences,
                      quietHours: {
                        ...preferences.quietHours,
                        toHour: Number(event.target.value),
                      },
                    })
                  }
                  className="ml-2 min-h-9 rounded-md border border-border/70 bg-background px-2 text-foreground"
                >
                  {HOURS.map((hour) => (
                    <option key={hour} value={hour}>
                      {String(hour).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-muted-foreground">
                Time zone
                <input
                  value={preferences.quietHours.timeZone}
                  onChange={(event) =>
                    update(
                      normalisePreferences(
                        {
                          ...preferences,
                          quietHours: {
                            ...preferences.quietHours,
                            timeZone: event.target.value,
                          },
                        },
                        availableIds,
                      ),
                    )
                  }
                  aria-label="Quiet hours time zone"
                  className="ml-2 min-h-9 rounded-md border border-border/70 bg-background px-2 text-foreground"
                />
              </label>
            </div>
          ) : null}
        </div>
      </GlassPanel>

      <GlassPanel className="flex flex-col gap-3 p-5">
        <h3 className="text-sm font-semibold text-foreground">Where notifications can go</h3>
        <ul className="space-y-2 text-[13px]">
          {channels.map((channel) => (
            <li key={channel.id} className="rounded-lg border border-border/60 p-3">
              <p className="font-medium text-foreground">{channel.title}</p>
              <p className="text-muted-foreground">{channel.description}</p>
              {channel.available ? null : (
                <p className="mt-1 text-muted-foreground">
                  <strong className="text-foreground">Not available.</strong>{" "}
                  {channel.unavailableReason}
                </p>
              )}
            </li>
          ))}
        </ul>

        {/*
         * THE PERMISSION IS ASKED FOR AFTER THE EXPLANATION, NOT BEFORE.
         *
         * A browser prompt that appears the moment somebody opens Settings is
         * the prompt people refuse reflexively — and a refusal is sticky, so
         * the reflex costs them the feature permanently. §D asks for the
         * explanation first, an explicit decline, and a way back later.
         */}
        {channels.find((channel) => channel.id === "web_push")?.available ? (
          <div className="rounded-lg border border-border/60 p-3 text-[13px]">
            {permission === "granted" ? (
              <p>This browser is allowed to show OCADE notifications.</p>
            ) : permission === "denied" ? (
              <p>
                This browser is blocking OCADE notifications. Nothing here can undo that — it has to
                be changed in the browser&rsquo;s own site settings, and OCADE will use it again as
                soon as it is.
              </p>
            ) : permission === "unsupported" ? (
              <p>This browser cannot show notifications outside the page.</p>
            ) : (
              <>
                <p>
                  OCADE can show a notification outside the page for the categories you chose above.
                  It never includes the message itself — only that something needs you.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={asking}
                  onClick={() => void askForBrowserPermission()}
                >
                  {asking ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                  Allow browser notifications
                </Button>
              </>
            )}
          </div>
        ) : null}
      </GlassPanel>

      <GlassPanel className="flex flex-col gap-3 p-5">
        <h3 className="text-sm font-semibold text-foreground">What to be told about</h3>
        <ul className="space-y-3">
          {NOTIFICATION_CATEGORIES.map((category) => {
            const chosen = preferences.categories[category.id];
            return (
              <li key={category.id} className="rounded-lg border border-border/60 p-3">
                <p className="text-[13px] font-medium text-foreground">
                  {category.title}
                  {category.optional ? null : (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      always sent
                    </span>
                  )}
                </p>
                <p className="text-[13px] text-muted-foreground">{category.description}</p>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  {channels
                    .filter((channel) => channel.available)
                    .map((channel) => (
                      <label key={channel.id} className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={chosen.channels.includes(channel.id)}
                          disabled={!category.optional && channel.id === "in_app"}
                          onChange={() => toggleChannel(category.id, channel.id)}
                        />
                        {channel.title}
                      </label>
                    ))}

                  {category.frequencies.length > 1 ? (
                    <label className="text-muted-foreground">
                      How often
                      <select
                        value={chosen.frequency}
                        onChange={(event) =>
                          setFrequency(category.id, event.target.value as NotificationFrequency)
                        }
                        className="ml-2 min-h-9 rounded-md border border-border/70 bg-background px-2 text-foreground"
                      >
                        {category.frequencies.map((frequency) => (
                          <option key={frequency} value={frequency}>
                            {FREQUENCY_LABEL[frequency]}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span className="text-muted-foreground">Sent immediately</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </GlassPanel>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const FREQUENCY_LABEL: Record<NotificationFrequency, string> = {
  immediate: "As it happens",
  grouped: "Grouped",
  digest: "Daily digest",
};
