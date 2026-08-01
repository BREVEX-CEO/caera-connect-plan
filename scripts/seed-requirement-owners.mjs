/**
 * Give every requirement an accountable owner.
 *
 * WHY THIS EXISTS
 * ---------------
 * All 510 rows carried a status, a weight and evidence, and not one carried an
 * owner. That is how a blocked requirement sits untouched for weeks: the row
 * says "EXTERNALLY BLOCKED", which sounds like a fact about the world, when it
 * is really a fact about a person who has not yet done a specific thing. A
 * blocker with no name attached is a blocker nobody is accountable for.
 *
 * Ownership is assigned from evidence, not invented:
 *
 *   - A row that is NOT externally blocked is owned by the programme. Nothing
 *     outside the repository is stopping it, so it is ours.
 *
 *   - A row that IS externally blocked is matched to one of the eight records
 *     in release/OCADE_RELEASE_BLOCKERS.json by its area. That file already
 *     names what evidence would clear each blocker; this adds who can produce
 *     it and the exact proof to run once they have.
 *
 * A row whose area matches no blocker record is NOT given a filler owner - it
 * is reported, so the gap is visible rather than papered over.
 *
 * Usage: node scripts/seed-requirement-owners.mjs [--write]
 * Exit:  0 when every row can be assigned; 1 when any row cannot.
 */
import { readFileSync, writeFileSync } from "node:fs";

const SNAPSHOT = "release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json";
const write = process.argv.includes("--write");

const REPO_OWNER = "repository owner";

/**
 * Requirement area -> the external party who can unblock it, what they must
 * supply, and the exact proof that closes the row once they have.
 *
 * Keys are matched as case-insensitive substrings of the row's `area`, longest
 * key first, so a specific area beats a general one.
 */
const EXTERNAL_OWNERS = [
  [
    "Signing and Trust Distribution",
    {
      owner: REPO_OWNER,
      thirdParty: "a code-signing certificate authority; Apple for notarisation",
      requires:
        "Windows code-signing certificate, Apple Developer team identity, and a Tauri updater keypair",
      proofWhenUnblocked:
        "tauri.conf.json certificateThumbprint and signingIdentity are non-null, pubkey is a real key, then a signed installer verifies on a clean machine",
    },
  ],
  [
    "Desktop Mobile and Extension Packaging",
    {
      owner: REPO_OWNER,
      thirdParty: "Apple, Google Play, Chrome Web Store, Microsoft Edge Add-ons",
      requires: "store enrolments and platform signing identities",
      proofWhenUnblocked:
        "npm run release:source-check with real signing config, plus a store submission receipt",
    },
  ],
  [
    "Clean-Machine Installation and First Run",
    {
      owner: REPO_OWNER,
      thirdParty: null,
      requires: "a freshly provisioned machine or CI runner and a signed installer",
      proofWhenUnblocked:
        "install, upgrade and rollback logs from a machine that never ran any prior version",
    },
  ],
  [
    "Supported Application Certification",
    {
      owner: REPO_OWNER,
      thirdParty: "the vendors of each licensed target application",
      requires: "licensed target applications and an exact version matrix",
      proofWhenUnblocked:
        "observed adapter actions with receipts, cancellation and recovery, per application version",
    },
  ],
  [
    "Staging Database and Controlled Deployment",
    {
      owner: REPO_OWNER,
      thirdParty: "Supabase",
      requires: "authorised Supabase project access and credentials",
      proofWhenUnblocked:
        "migrations applied in documented order, verification SQL passing, cross-tenant attack test failing correctly",
    },
  ],
  [
    "Database Schema Migrations and Rollback",
    {
      owner: REPO_OWNER,
      thirdParty: "Supabase",
      requires: "authorised Supabase project access and credentials",
      proofWhenUnblocked:
        "full migration set applies cleanly to an empty database, with rollback and verification",
    },
  ],
  [
    "Authentication Accounts and Device Management",
    {
      owner: REPO_OWNER,
      thirdParty: "Supabase",
      requires: "Supabase project keys",
      proofWhenUnblocked: "a real sign-in, session and device revocation observed end to end",
    },
  ],
  [
    "Cloud Relay and Service Deployment",
    {
      owner: REPO_OWNER,
      thirdParty: "Cloudflare",
      requires:
        "CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, a production domain and deployment authority",
      proofWhenUnblocked:
        "npm run deploy:check passing, then a deployed /api/health responding over HTTPS",
    },
  ],
  [
    "Production Operations and Incident Response",
    {
      owner: REPO_OWNER,
      thirdParty: "Cloudflare",
      requires: "a deployed environment with monitoring and alerting configured",
      proofWhenUnblocked: "an alert fired and acknowledged against the real deployment",
    },
  ],
  [
    "Mobile Application and Native Bridge",
    {
      owner: REPO_OWNER,
      thirdParty: "Google (Android), Apple (iOS)",
      requires: "Android SDK and a device or emulator; macOS and Xcode for iOS",
      proofWhenUnblocked:
        "signed bundle installed, pairing approved, stop and recovery observed on the device",
    },
  ],
  [
    "Browser Extension and Web Control",
    {
      owner: REPO_OWNER,
      thirdParty: "Google (Chrome Web Store), Microsoft (Edge Add-ons)",
      requires: "supported Chrome and Edge installations, then store identities for publication",
      proofWhenUnblocked:
        "silent policy-based install, observed DOM control, and permission-revocation tests",
    },
  ],
  [
    "Stakeholder Discovery and Workflow Research",
    {
      owner: REPO_OWNER,
      thirdParty: "the people being interviewed",
      requires: "real participants who consent to being interviewed and observed",
      proofWhenUnblocked: "retained, consented interview and observation records",
    },
  ],
  [
    "Internal Alpha and Dogfooding",
    {
      owner: REPO_OWNER,
      thirdParty: "alpha participants",
      requires: "a distributable build and consenting internal testers",
      proofWhenUnblocked: "retained session and defect records from real alpha use",
    },
  ],
  [
    "External Beta and Controlled Expansion",
    {
      owner: REPO_OWNER,
      thirdParty: "beta participants",
      requires: "a signed distributable build and consenting external testers",
      proofWhenUnblocked: "retained beta cohort telemetry and defect records",
    },
  ],
  [
    "Production Launch",
    {
      owner: REPO_OWNER,
      thirdParty: null,
      requires: "explicit owner launch authority; every other blocker cleared first",
      proofWhenUnblocked: "npm run launch-authority:check passing against a real deployment",
    },
  ],
  // The desktop-control cluster. All of it waits on the same thing: permission
  // to run a desktop control agent against the owner's real machine, in a
  // defined window, with a supervisor able to trigger emergency stop. That is
  // recorded in release/OCADE_P24_COMPANION_BUILD_EVIDENCE.json as a deliberate
  // refusal, not a tooling limitation - the companion builds.
  [
    "Desktop Companion Foundation",
    {
      owner: REPO_OWNER,
      thirdParty: null,
      requires:
        "explicit approval for a supervised companion run, a scoped target application, and a defined test window",
      proofWhenUnblocked:
        "companion start/stop, pairing and emergency stop observed against a real scoped application",
    },
  ],
  [
    "Windows Process Application and Window Control",
    {
      owner: REPO_OWNER,
      thirdParty: null,
      requires: "explicit approval for a supervised companion run against a scoped application",
      proofWhenUnblocked:
        "window open/close/focus observed and independently verified, with receipts",
    },
  ],
  [
    "Scoped Keyboard Mouse Clipboard and Files",
    {
      owner: REPO_OWNER,
      thirdParty: null,
      requires:
        "explicit approval for a supervised companion run against a scoped folder and application",
      proofWhenUnblocked:
        "text entry, clipboard and reversible file operations observed, verified and rolled back",
    },
  ],
  [
    "Screen Capture Vision and Set-of-Mark",
    {
      owner: REPO_OWNER,
      thirdParty: null,
      requires: "explicit approval for scoped screen capture on the owner's display",
      proofWhenUnblocked:
        "a real capture, mark overlay, action and post-action visual verification",
    },
  ],
  [
    "Voice Input Output Wake and Protected Speech",
    {
      owner: REPO_OWNER,
      thirdParty: null,
      requires: "a microphone and speaker session with explicit consent to record",
      proofWhenUnblocked:
        "wake phrase, live caption, spoken reply and voice emergency stop observed in one session",
    },
  ],
  [
    "Accessibility and Semantic UI Control",
    {
      owner: REPO_OWNER,
      thirdParty: null,
      requires: "a real screen reader and a supervised companion run",
      proofWhenUnblocked:
        "accessibility-tree reads and semantic control observed against a real application",
    },
  ],
  [
    "Relay Service and Remote Sessions",
    {
      owner: REPO_OWNER,
      thirdParty: null,
      requires: "a reachable host for the relay and two real devices on different networks",
      proofWhenUnblocked:
        "a phone on a different network reaching a real PC task through the relay",
    },
  ],
];

const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
const rows = snapshot.requirements;

// Longest area key first so a specific match wins over a general one.
const ordered = [...EXTERNAL_OWNERS].sort((a, b) => b[0].length - a[0].length);

const unassignable = [];
let external = 0;
let internal = 0;

for (const row of rows) {
  if (row.status !== "EXTERNALLY BLOCKED") {
    row.owner = "OCADE programme";
    row.ownerKind = "internal";
    delete row.blockerOwner;
    internal += 1;
    continue;
  }

  const area = String(row.area ?? "");
  const match = ordered.find(([key]) => area.toLowerCase().includes(key.toLowerCase()));

  if (!match) {
    // Deliberately NOT given a filler owner. An unassignable blocked row is a
    // real gap in accountability and must stay visible.
    unassignable.push(`${row.id} — ${row.area}`);
    continue;
  }

  const [, spec] = match;
  row.owner = spec.owner;
  row.ownerKind = "external";
  row.blockerOwner = {
    owner: spec.owner,
    thirdParty: spec.thirdParty,
    requires: spec.requires,
    proofWhenUnblocked: spec.proofWhenUnblocked,
  };
  external += 1;
}

console.log(`Owners assigned — internal: ${internal}, external: ${external}`);

if (unassignable.length > 0) {
  console.error(`\nBLOCKED ROWS WITH NO ASSIGNABLE OWNER (${unassignable.length}):`);
  for (const item of unassignable) console.error(`- ${item}`);
  console.error("\nAdd an EXTERNAL_OWNERS entry for each area above. No filler owner was written.");
  process.exit(1);
}

if (write) {
  writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`Wrote ${SNAPSHOT}.`);
} else {
  console.log("Dry run. Pass --write to persist.");
}
