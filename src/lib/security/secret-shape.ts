/**
 * KEY-16: OCADE never asks for a key in a message, and warns before one is sent by mistake.
 *
 * Recognises the shapes of common credentials (provider API keys, access tokens, private key
 * blocks). A match does not prove a secret; it is a reason to ask the person once. Keys belong
 * in Settings, BYOK, where they are stored encrypted and never shown to a model.
 */
const SHAPES: { name: string; pattern: RegExp }[] = [
  { name: "an OpenAI-style API key", pattern: /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/ },
  { name: "a Google API key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  {
    name: "a GitHub token",
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/,
  },
  { name: "an AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "a Slack token", pattern: /\bxox[abpors]-[A-Za-z0-9-]{10,}/ },
  { name: "a Stripe secret key", pattern: /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}/ },
  { name: "a Supabase secret key", pattern: /\bsb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: "a private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

/** Bearer tokens and JWTs, which are credentials in logs whatever issued them. */
const LOG_ONLY: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
];

/**
 * KEY-13: the same shapes (and bearer tokens and JWTs) replaced by a marker, for anything that is
 * written to a log. The marker names the kind, never any part of the value.
 */
export function redactSecrets(text: string): string {
  let out = text;
  for (const shape of SHAPES)
    out = out.replace(new RegExp(shape.pattern.source, "g"), `[redacted ${shape.name}]`);
  for (const pattern of LOG_ONLY) out = out.replace(pattern, "[redacted token]");
  return out;
}

/**
 * Route every console method of this server through `redactSecrets` (KEY-13), once. Errors are
 * logged by message and stack only, also redacted.
 */
export function redactConsole(target: Pick<Console, "log" | "info" | "warn" | "error" | "debug">) {
  const marked = target as typeof target & { __ocadeRedacted?: boolean };
  if (marked.__ocadeRedacted) return;
  marked.__ocadeRedacted = true;
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    const original = target[level].bind(target);
    target[level] = (...args: unknown[]) =>
      original(
        ...args.map((arg) =>
          typeof arg === "string"
            ? redactSecrets(arg)
            : arg instanceof Error
              ? redactSecrets(`${arg.name}: ${arg.message}\n${arg.stack ?? ""}`)
              : (() => {
                  try {
                    return redactSecrets(JSON.stringify(arg));
                  } catch {
                    return "[unloggable value]";
                  }
                })(),
        ),
      );
  }
}

/** What the text seems to contain, or null. */
export function secretShape(text: string): string | null {
  for (const shape of SHAPES) if (shape.pattern.test(text)) return shape.name;
  return null;
}

/**
 * Ask once before sending text that looks like it holds a credential. True means send.
 * Browser-only; a server never calls this.
 */
export function confirmSendWithSecret(text: string): boolean {
  const found = secretShape(text);
  if (!found) return true;
  return window.confirm(
    `This message looks like it contains ${found}. OCADE never needs a password or key in a ` +
      "message; add provider keys under Settings, BYOK, instead. Send it anyway?",
  );
}
