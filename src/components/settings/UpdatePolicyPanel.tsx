import { ShieldCheck, ShieldAlert, ArrowUpCircle, CircleSlash } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { planUpdate, type UpdateDecision, type UpdateManifest } from "@/lib/packaging/update-plan";

/**
 * What OCADE would do with an offered update — and why it would refuse.
 *
 * `update-plan` is the deterministic half of self-update: it decides apply /
 * skip / refuse, and every refusal names its reason. It was fully implemented
 * and tested but reached by no route or panel, so the rules it enforces were
 * invisible to the person they protect.
 *
 * The rules shown below are evaluated by the REAL engine at render time. They
 * are not descriptions of the policy; they are the policy, run.
 *
 * HONEST STATE: OCADE cannot currently verify an update on this machine. The
 * Tauri config still carries a placeholder signing public key, so there is no
 * trusted key to check a signature against. The panel says that plainly rather
 * than implying updates are ready to install.
 */

const CURRENT_VERSION = "0.1.0";

/** Each case is a real manifest run through the real planner. */
const CASES: { label: string; manifest: UpdateManifest }[] = [
  {
    label: "Properly signed newer build",
    manifest: {
      version: "0.2.0",
      signature: "a-detached-signature",
      sha256: "b".repeat(64),
      url: "https://example.invalid/ocade-0.2.0.msi",
    },
  },
  {
    label: "Unsigned build",
    manifest: { version: "0.2.0", signature: "", sha256: "b".repeat(64) },
  },
  {
    label: "No content hash",
    manifest: { version: "0.2.0", signature: "a-detached-signature", sha256: "" },
  },
  {
    label: "Older than installed",
    manifest: {
      version: "0.0.9",
      signature: "a-detached-signature",
      sha256: "b".repeat(64),
    },
  },
  {
    label: "Requires an intermediate upgrade first",
    manifest: {
      version: "0.9.0",
      signature: "a-detached-signature",
      sha256: "b".repeat(64),
      minimumClientVersion: "0.5.0",
    },
  },
];

const ROWS = CASES.map((entry) => ({
  ...entry,
  decision: planUpdate(entry.manifest, { currentVersion: CURRENT_VERSION }),
}));

function presentation(decision: UpdateDecision): { icon: typeof ShieldCheck; text: string } {
  switch (decision.action) {
    case "apply":
      return { icon: ArrowUpCircle, text: `Would install ${decision.to}` };
    case "skip":
      return { icon: CircleSlash, text: decision.reason };
    case "refuse":
      return { icon: ShieldAlert, text: decision.reason };
  }
}

export function UpdatePolicyPanel() {
  return (
    <GlassPanel className="p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="h-4 w-4" aria-hidden />
        Update policy
      </h3>
      <p className="text-xs text-muted-foreground">
        What OCADE would do with an offered update, decided by the same code the updater runs. An
        update with no signature or no content hash is refused — never installed with a warning.
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {ROWS.map((row) => {
          const shown = presentation(row.decision);
          const Icon = shown.icon;
          return (
            <li
              key={row.label}
              className="flex items-start gap-2 rounded-lg border border-border/70 p-3"
            >
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="text-[11px]">
                <span className="font-medium">{row.label}</span>
                <br />
                <span className="text-muted-foreground">{shown.text}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 rounded-lg border border-border/70 p-3">
        <p className="text-[11px] font-medium">Automatic updates are not available yet</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          The desktop build still carries a placeholder signing key, so there is no trusted key to
          check a signature against. Signature verification is implemented and tested, but until a
          real key pair is generated and the placeholder replaced, OCADE will refuse every update
          rather than install one it cannot verify.
        </p>
      </div>
    </GlassPanel>
  );
}
