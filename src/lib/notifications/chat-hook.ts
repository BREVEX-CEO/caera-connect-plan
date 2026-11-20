/**
 * CHAT-APP NOTIFICATIONS (plan REPO-20; owner rejected the deferral): a person may connect one
 * incoming-webhook address of their own chat app, and OCADE posts the notifications they already
 * receive there. Notification only: nothing sent to or from a chat app can approve, start or
 * change anything in OCADE, and OCADE never reads replies.
 *
 * Only the four providers' own webhook hosts are accepted, over HTTPS on the default port, so the
 * server can never be pointed at an internal or arbitrary address (SSRF).
 */
export type ChatKind = "slack" | "discord" | "teams" | "ntfy";

const HOSTS: readonly { kind: ChatKind; host: RegExp; path: RegExp }[] = [
  { kind: "slack", host: /^hooks\.slack\.com$/, path: /^\/services\/[A-Za-z0-9/_-]{10,200}$/ },
  {
    kind: "discord",
    host: /^(discord|discordapp)\.com$/,
    path: /^\/api\/webhooks\/\d{5,30}\/[A-Za-z0-9_-]{20,200}$/,
  },
  {
    kind: "teams",
    host: /^[a-z0-9-]{1,63}\.(webhook\.office\.com|logic\.azure\.com)$/,
    path: /^\/[A-Za-z0-9/@._~%:-]{10,600}$/,
  },
  { kind: "ntfy", host: /^ntfy\.sh$/, path: /^\/[A-Za-z0-9_-]{8,64}$/ },
];

/** The provider of an accepted webhook address, or null. */
export function chatHookKind(address: string): ChatKind | null {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash)
    return null;
  const match = HOSTS.find(
    (entry) => entry.host.test(url.hostname) && entry.path.test(url.pathname),
  );
  return match?.kind ?? null;
}

/** The request body each provider reads; text only, bounded. */
export function chatRequest(
  kind: ChatKind,
  message: { title: string; body: string; link: string },
): { body: string; headers: Record<string, string> } {
  const title = message.title.slice(0, 200);
  const text = `${title}${message.body ? `\n${message.body.slice(0, 1000)}` : ""}\n${message.link}`;
  if (kind === "ntfy") {
    return {
      body: `${message.body.slice(0, 1000)}\n${message.link}`.trim(),
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        Title: title.replace(/[^\x20-\x7e]/g, ""),
      },
    };
  }
  const json = kind === "discord" ? { content: text.slice(0, 1900) } : { text };
  return { body: JSON.stringify(json), headers: { "Content-Type": "application/json" } };
}
