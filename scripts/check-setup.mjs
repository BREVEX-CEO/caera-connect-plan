/**
 * Setup and credential readiness check.
 *
 * Specification: "permission/credential setup wizards", and §22's instruction to
 * "record the external prerequisite" so the remaining human step is as small as
 * possible.
 *
 * This answers one question precisely: WHAT IS STOPPING EACH CAPABILITY, and
 * what exactly must be done about it. Without it, the honest answer to "why is
 * PC control not working" is buried across a release ledger, a definition-of-done
 * matrix and several comments.
 *
 * SAFETY, NON-NEGOTIABLE:
 *  - Secret VALUES are never read, printed, logged or length-reported beyond a
 *    coarse "present / absent". Knowing a key exists is enough to advise; the
 *    value is never this script's business.
 *  - Nothing is written, installed, fetched or configured. It reports.
 *  - A credential that is present is NOT reported as working. Presence is not
 *    validity — only a real call proves that, and this script makes none.
 *
 * Usage: node scripts/check-setup.mjs [--json]
 * Exit:  0 always. A missing prerequisite is information, not a failure —
 *        running this on a fresh machine should not look like a broken build.
 */

import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const jsonOnly = process.argv.includes("--json");

/** Present-or-absent only. The value is never inspected. */
function envPresent(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

function commandPresent(command, args = ["--version"]) {
  try {
    execFileSync(command, args, { stdio: "ignore", timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

const CHECKS = [
  {
    id: "supabase",
    capability: "Accounts, cloud sync, entitlements, cross-user isolation",
    satisfied: () => envPresent("SUPABASE_URL") && envPresent("SUPABASE_PUBLISHABLE_KEY"),
    detail: () =>
      `SUPABASE_URL ${envPresent("SUPABASE_URL") ? "set" : "MISSING"}, SUPABASE_PUBLISHABLE_KEY ${envPresent("SUPABASE_PUBLISHABLE_KEY") ? "set" : "MISSING"}`,
    action:
      "Connect Supabase in Lovable Cloud, then apply the 32 migrations. Every one has a paired rollback and a self-checking verification script in supabase/verification/.",
    unlocks: "7 identity items plus cross-user isolation — the largest single cluster.",
  },
  {
    id: "supabase-admin",
    capability: "Server-side admin operations (country packs, launch gate)",
    satisfied: () => envPresent("SUPABASE_SERVICE_ROLE_KEY"),
    detail: () =>
      `SUPABASE_SERVICE_ROLE_KEY ${envPresent("SUPABASE_SERVICE_ROLE_KEY") ? "set" : "MISSING"}`,
    action:
      "Set SUPABASE_SERVICE_ROLE_KEY through platform secret storage. Never place it in a client bundle or commit it.",
    unlocks: "Admin-only server functions.",
  },
  {
    id: "ai-gateway",
    capability: "Cloud chat and AI assist",
    satisfied: () => envPresent("LOVABLE_API_KEY") || envPresent("OPENAI_API_KEY"),
    detail: () =>
      `LOVABLE_API_KEY ${envPresent("LOVABLE_API_KEY") ? "set" : "absent"}, OPENAI_API_KEY ${envPresent("OPENAI_API_KEY") ? "set" : "absent"}`,
    action:
      "Provide either key through platform secret storage. Both are read server-side only and never reach the client.",
    unlocks: "Cloud chat. Local models remain the first choice regardless.",
  },
  {
    id: "msvc",
    capability: "Windows companion binary, and executing the Rust safety tests locally",
    satisfied: () =>
      existsSync("C:/Program Files/Microsoft Visual Studio") ||
      existsSync("C:/Program Files (x86)/Microsoft Visual Studio"),
    detail: () => "Visual Studio / MSVC build tools not found in the standard install locations",
    action:
      'Install Visual Studio Build Tools with "Desktop development with C++", then run cargo from the x64 Native Tools Command Prompt — GNU coreutils link.exe shadows MSVC\'s linker on the Git Bash PATH. CI already runs these tests on windows-latest with no human step.',
    unlocks: "The 10 Rust safety assertions locally; the companion build.",
  },
  {
    id: "rust",
    capability: "Rust toolchain",
    satisfied: () => commandPresent("cargo"),
    detail: () => (commandPresent("cargo") ? "cargo present" : "cargo not on PATH"),
    action: "Install Rust via rustup.",
    unlocks: "Type-checking and linting the safety core.",
  },
  {
    id: "android",
    capability: "Android build and emulator tests",
    satisfied: () => envPresent("ANDROID_HOME") || envPresent("ANDROID_SDK_ROOT"),
    detail: () => "ANDROID_HOME / ANDROID_SDK_ROOT not set",
    action:
      "Install the Android SDK and a JDK, or run the prepared android job in .github/workflows/platforms.yml.",
    unlocks: "Android runtime evidence.",
  },
  {
    id: "docker",
    capability: "One-command relay deployment",
    satisfied: () => commandPresent("docker"),
    detail: () => (commandPresent("docker") ? "docker present" : "docker not on PATH"),
    action: "Install Docker, then `docker compose up --build` to run the relay on :8787.",
    unlocks: "Cross-device runtime over a real transport.",
  },
  {
    id: "free-tools",
    capability: "Real render, CAD and solver evidence",
    satisfied: () =>
      commandPresent("blender") || commandPresent("freecadcmd") || commandPresent("ccx", ["-v"]),
    detail: () => "Blender, FreeCAD and CalculiX all absent from PATH",
    action:
      "Install any of Blender, FreeCAD or CalculiX — all are free and open source. Detection is automatic; no configuration is needed.",
    unlocks: "Vision/3D and engineering move from fixture class to real evidence.",
  },
  {
    id: "signing",
    capability: "Signed installers and a working auto-update",
    satisfied: () => {
      try {
        const conf = readFileSync("native/companion/tauri/tauri.conf.json", "utf8");
        return !conf.includes("REPLACE_WITH_SIGNING_PUBLIC_KEY");
      } catch {
        return false;
      }
    },
    detail: () => "tauri.conf.json still contains the placeholder signing public key",
    action:
      "Generate a Tauri updater key pair and replace the placeholder, then supply the private key to CI as a secret. The verification side is already implemented and tested against a self-signed key.",
    unlocks: "Packaging: signed releases and verified updates.",
  },
];

const results = CHECKS.map((check) => {
  let satisfied = false;
  try {
    satisfied = Boolean(check.satisfied());
  } catch {
    satisfied = false;
  }
  return {
    id: check.id,
    capability: check.capability,
    // "ready" means the prerequisite is PRESENT. It does not mean it works —
    // only a real call proves that, and this script makes none.
    status: satisfied ? "present" : "missing",
    detail: satisfied ? "prerequisite present" : check.detail(),
    action: satisfied ? null : check.action,
    unlocks: check.unlocks,
  };
});

const missing = results.filter((r) => r.status === "missing");

const report = {
  generatedAt: new Date().toISOString(),
  note: "`present` means the prerequisite exists, NOT that it is valid or working. No credential value is ever read or printed, and nothing is installed or configured by this script.",
  summary: { present: results.length - missing.length, missing: missing.length },
  results,
};

if (jsonOnly) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("OCADE setup readiness\n");
  for (const r of results) {
    console.log(
      `  [${r.status === "present" ? " ok " : "todo"}] ${r.id.padEnd(15)} ${r.capability}`,
    );
    if (r.status === "missing") {
      console.log(`         ${r.detail}`);
      console.log(`         -> ${r.action}`);
      console.log(`         unlocks: ${r.unlocks}`);
    }
    console.log("");
  }
  console.log(`  ${report.summary.present} present, ${report.summary.missing} still needed.`);
  console.log("  'present' means the prerequisite exists, not that it has been proven to work.");
}

// Always 0: a fresh machine missing prerequisites is not a broken build.
process.exit(0);
