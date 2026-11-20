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
