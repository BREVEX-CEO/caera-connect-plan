/**
 * WHAT A STRANGER CAN READ.
 *
 * Everything in the client bundle is public. Not "obfuscated", not "minified
 * so nobody will look" — public, permanently, to anyone who opens the network
 * tab. That is fine and normal; the only question is whether anything in there
 * should not have been.
 *
 * Two kinds of finding:
 *
 *   SECRET-SHAPED STRINGS — a service-role JWT, a live payment key, a private
 *   key block, an AWS access key id. These are unambiguous.
 *
 *   SERVER-ONLY NAMES — Vite inlines anything prefixed `VITE_` and nothing
 *   else, but a `process.env.SUPABASE_SERVICE_ROLE_KEY` reached from a module
 *   that ends up in a client chunk becomes `undefined` at best and inlined at
 *   worst, depending on how it was written. The NAME appearing in a client
 *   chunk is the signal that a server module was pulled across the boundary.
 *
 * Usage: node scripts/scan-bundle-secrets.mjs [dir=.output/public]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const root = process.argv[2] ?? ".output/public";

/** Shapes that are a secret wherever they appear. */
const SECRET_SHAPES = [
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

/**
 * Names that only ever belong on a server. Their PRESENCE in a client chunk
 * means a server module crossed the boundary, whether or not a value came with
 * it.
 */
const SERVER_ONLY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "PADDLE_API_KEY",
  "PADDLE_WEBHOOK_SECRET",
  "RAZORPAY_KEY_SECRET",
  "STRIPE_SECRET_KEY",
  "RESEND_API_KEY",
  "OCADE_LEASE_SIGNING_PRIVATE_KEY",
  "OCADE_LEASE_PREVIOUS_VERIFICATION_KEYS",
  "SERVICE_ROLE",
];

function files(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files(full, out);
    else if ([".js", ".mjs", ".cjs", ".css", ".html", ".json", ".map"].includes(extname(entry)))
      out.push(full);
  }
  return out;
}

let scanned = 0;
const findings = [];

let list;
try {
  list = files(root);
} catch {
  console.error(`No bundle at ${root}. Build first, or pass the directory.`);
  process.exit(2);
}
if (list.length === 0) {
  console.error(`${root} contains nothing scannable — refusing to report a clean scan.`);
  process.exit(2);
}

for (const file of list) {
  const text = readFileSync(file, "utf8");
  scanned += 1;
  for (const shape of SECRET_SHAPES) {
    for (const match of text.matchAll(shape.test())) {
      if (shape.verify && !shape.verify(match[0])) continue;
      findings.push({
        file,
        kind: shape.name,
        // Never print the value. A scanner that echoes what it found is a
        // scanner that puts the secret in CI logs as well.
        hint: `${match[0].slice(0, 6)}… (${match[0].length} chars)`,
      });
    }
  }
  for (const name of SERVER_ONLY_NAMES) {
    if (text.includes(name)) {
      findings.push({ file, kind: `server-only name ${name}`, hint: "present in a client chunk" });
    }
  }
}

console.log(`scanned ${scanned} files under ${root}`);
if (findings.length === 0) {
  console.log("no secret-shaped strings and no server-only names in the client bundle");
  process.exit(0);
}
console.error(`\n${findings.length} finding(s):`);
for (const f of findings) console.error(`  ${f.kind}\n    ${f.file}\n    ${f.hint}`);
process.exit(1);
