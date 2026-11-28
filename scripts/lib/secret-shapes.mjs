// Shared secret shapes: used by the bundle scanner and the history/artifact scanner.
/** Shapes that are a secret wherever they appear. */
export const SECRET_SHAPES = [
  {
    name: "Supabase service-role JWT",
    // The payload of a service-role key decodes to {"role":"service_role"}.
    test: (text) => /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g,
    verify: (match) => {
      try {
        const payload = JSON.parse(Buffer.from(match.split(".")[1], "base64url").toString("utf8"));
        return payload.role === "service_role";
      } catch {
        return false;
      }
    },
  },
  { name: "Supabase secret key", test: () => /\bsb_secret_[A-Za-z0-9_-]{10,}/g },
  { name: "Stripe live secret key", test: () => /\bsk_live_[A-Za-z0-9]{16,}/g },
  { name: "Stripe test secret key", test: () => /\bsk_test_[A-Za-z0-9]{16,}/g },
  { name: "AWS access key id", test: () => /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "private key block", test: () => /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: "Paddle API key", test: () => /\bpdl_(live|sdbx)_apikey_[A-Za-z0-9_]{16,}/g },
  { name: "GitHub token", test: () => /\bgh[pousr]_[A-Za-z0-9]{30,}/g },
  { name: "Google API key", test: () => /\bAIza[0-9A-Za-z_-]{35}\b/g },
];
