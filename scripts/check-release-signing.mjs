#!/usr/bin/env node
/**
 * Refuse to publish an unsigned release.
 *
 * WHY THIS GATE EXISTS. Code signing is the strongest anti-tampering layer OCADE
 * has -- stronger than the checksum self-audit, because the operating system
 * enforces it before a single instruction of ours runs. A patched binary fails
 * the OS signature check whether or not our own code agrees.
 *
 * `certificateThumbprint` is null in the committed config, which is correct: a
 * thumbprint is per-organisation and does not belong in a public repository. The
 * danger is that null is ALSO what an unsigned build looks like, so a release
 * could quietly ship unsigned and nobody would find out until a customer saw a
 * SmartScreen warning on first launch and decided the product was malware.
 *
 * So this reads the environment rather than the file, and fails a release build
 * that has no certificate configured. Development builds are unaffected -- they
 * are supposed to be unsigned, and demanding a certificate to run the app
 * locally would make the gate something people disable.
 *
 * Usage:
 *   node scripts/check-release-signing.mjs            # release check
 *   node scripts/check-release-signing.mjs --explain  # print setup steps
 *
 * The certificate is supplied at build time, never committed:
 *   TAURI_SIGNING_PRIVATE_KEY            updater signing key (already used)
 *   OCADE_WINDOWS_CERT_THUMBPRINT        SHA-1 thumbprint of the code-signing cert
 *   OCADE_LICENCE_PUBLIC_KEY             minisign public key for licences
 *   OCADE_BINARY_SHA256                  stamped after linking, for the self-audit
 */

const REQUIRED = [
  {
    name: "OCADE_WINDOWS_CERT_THUMBPRINT",
    why: "Windows code signing. Without it, users meet a SmartScreen warning and the binary can be modified undetectably.",
  },
  {
    name: "OCADE_LICENCE_PUBLIC_KEY",
    why: "Offline licence verification. Without it every licence reports 'cannot be checked' rather than verifying.",
  },
];

const OPTIONAL = [
  {
    name: "OCADE_BINARY_SHA256",
    why: "Startup checksum self-audit. Computed AFTER linking, so it is stamped by the release pipeline, not by hand.",
  },
  {
    name: "OCADE_LICENSED_HARDWARE_ID",
    why: "Per-customer hardware binding. Only set when cutting a machine-bound build.",
  },
];

function explain() {
  console.log("OCADE release signing\n");
  console.log("Required for a release build:");
  for (const item of REQUIRED) console.log(`  ${item.name}\n    ${item.why}`);
  console.log("\nOptional:");
  for (const item of OPTIONAL) console.log(`  ${item.name}\n    ${item.why}`);
  console.log(
    "\nNone of these belong in the repository. Set them in the release\n" +
      "environment only. A licence key pair is generated once, offline, and the\n" +
      "SECRET half never leaves the company:\n\n" +
      "  minisign -G -p ocade-licence.pub -s ocade-licence.key\n\n" +
      "Publish nothing but the public half, which is what gets compiled in.",
  );
}

if (process.argv.includes("--explain")) {
  explain();
  process.exit(0);
}

const missing = REQUIRED.filter(({ name }) => !process.env[name]);

if (missing.length > 0) {
  console.error("Release blocked: this build would ship unsigned or unverifiable.\n");
  for (const item of missing) {
    console.error(`  missing ${item.name}`);
    console.error(`    ${item.why}\n`);
  }
  console.error("Run with --explain for setup steps.");
  process.exit(1);
}

const notStamped = OPTIONAL.filter(({ name }) => !process.env[name]).map((i) => i.name);
console.log("Release signing configured.");
if (notStamped.length > 0) {
  // Reported, not failed. These degrade to "cannot verify", which the Rust side
  // reports honestly as Unknown rather than upgrading to Verified.
  console.log(`Not stamped (will report as unverified): ${notStamped.join(", ")}`);
}
