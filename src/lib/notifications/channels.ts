/**
 * WHERE A NOTIFICATION CAN ACTUALLY GO, DERIVED RATHER THAN DECLARED.
 *
 * PLAN.md §D is blunt about this: "Never claim push works because an
 * abstraction exists", and "If a channel is unconfigured, hide its enable
 * control or show an exact unavailable state."
 *
 * The failure it is guarding against is a settings screen offering four
 * toggles, three of which do nothing. Somebody turns on email alerts for
 * security events, believes they will be told when their account is touched,
 * and is not — which is worse than never having been offered the toggle, and
 * the product looked more capable for it right up until it mattered.
 *
 * So availability is COMPUTED from what the deployment actually has, the same
 * way checkout availability is, and a channel that is not configured reports
 * why in words a person can act on.
 */

export type NotificationChannelId = "in_app" | "email" | "web_push";

export interface NotificationChannel {
  id: NotificationChannelId;
  title: string;
  /** What arrives on this channel. */
  description: string;
  available: boolean;
  /**
   * Present exactly when `available` is false, and written for the person
   * rather than the operator: it never names a missing environment variable.
   */
  unavailableReason?: string;
}

export interface ChannelConfiguration {
  /** A VAPID public key, for browser push. */
  webPushPublicKey?: string;
}

/**
 * In-app is always available, and that is a fact about the architecture rather
 * than an assumption: the notification is a row the product renders itself,
 * with no provider between OCADE and the screen.
 */
export function resolveChannels(configuration: ChannelConfiguration): NotificationChannel[] {
  const present = (value: string | undefined) => Boolean(value && value.trim());

  return [
    {
      id: "in_app",
      title: "In OCADE",
      description: "In the Inbox, and on the bell, while OCADE is open.",
      available: true,
    },
    {
      id: "email",
      title: "Email",
      description: "To the address on your account.",
      // No email transport exists yet, so email is never offered: a sender
      // address alone once made it selectable and recorded as sent (F-079).
      available: false,
      unavailableReason: "OCADE does not send notification emails yet, so it cannot promise one.",
    },
    {
      id: "web_push",
      title: "Browser notifications",
      description: "From this browser, even when OCADE is not the active tab.",
      available: present(configuration.webPushPublicKey),
      ...(present(configuration.webPushPublicKey)
        ? {}
        : {
            unavailableReason:
              "No browser push service is connected to this deployment, so OCADE would have nowhere to send them.",
          }),
    },
  ];
}

/**
 * The configuration this build was compiled with.
 *
 * Read from `import.meta.env` so the answer is about the DEPLOYMENT rather than
 * about the browser, and read here once so no surface can form its own opinion.
 * Public identifiers only: a VAPID public key and a sender address are meant to be
 * in a bundle; nothing secret is or can be.
 */
export function deploymentChannelConfiguration(): ChannelConfiguration {
  const env = import.meta.env as Record<string, string | undefined>;
  return {
    webPushPublicKey: env.VITE_WEB_PUSH_PUBLIC_KEY,
  };
}

/** Just the channels a person could genuinely turn on. */
export function availableChannels(configuration: ChannelConfiguration): NotificationChannel[] {
  return resolveChannels(configuration).filter((channel) => channel.available);
}
