import { useCallback, useMemo, useState } from "react";
import { ShieldCheck, ShieldX } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import {
  evaluateSkillTrust,
  RevocationList,
  HIGH_RISK_CAPABILITIES,
  type SkillCapability,
  type TrustVerdict,
} from "@/lib/skills/skill-trust";

/**
 * Production owner for signed, revocable community skills (P11.S05).
 *
 * Nothing in this repository could WITHDRAW an installed skill — grep for
 * revocation returned nothing at all. A community skill drives someone's
 * computer, so a skill later found to be malicious would have stayed installed
 * and trusted on every machine that had it.
 *
 * The panel makes each refusal visible because they are easy to confuse and
 * lead to different actions: a revoked skill is not a broken skill, and an
 * unconfigured signing key is not a bad signature.
 */

const CAPS: SkillCapability[] = ["read_screen", "click", "type", "read_files", "run_cli"];

export function SkillTrustPanel() {
  const [granted, setGranted] = useState<SkillCapability[]>(["read_screen", "click"]);
  const [signed, setSigned] = useState(true);
  const [revoked, setRevoked] = useState(false);
  const [appVersion, setAppVersion] = useState("4.1.0");
  const [verdict, setVerdict] = useState<TrustVerdict | null>(null);

  const revocations = useMemo(() => {
    const list = new RevocationList();
    if (revoked) {
      list.revokeAllVersions(
        "skill.community.invoice",
        "withdrawn by the publisher after a report",
      );
    }
    return list;
  }, [revoked]);

  const check = useCallback(async () => {
    setVerdict(
      await evaluateSkillTrust({
        skill: {
          manifest: {
            id: "skill.community.invoice",
            version: "1.2.3",
            publisher: "community",
            contentSha256: "a".repeat(64),
            capabilities: ["read_screen", "click"],
            targetAppId: "com.example.editor",
            targetAppVersion: "4.1.0",
          },
          // No real signature here: this installation has no configured
          // publisher key, which the verdict reports as "cannot check" rather
          // than as a failed check.
          signatureBase64: signed ? "c2lnbmF0dXJl" : null,
        },
        publishers: [{ publisher: "community", publicKeyBase64: "REPLACE_WITH_PUBLISHER_KEY" }],
        revocations: revocations.all(),
        grantedCapabilities: granted,
        observedAppVersion: appVersion,
      }),
    );
  }, [signed, revocations, granted, appVersion]);

  return (
    <GlassPanel className="p-4" data-testid="skill-trust-panel">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="h-4 w-4" aria-hidden />
        Community skill trust
      </h3>
      <p className="text-xs text-muted-foreground">
        A community skill can drive your computer, so it must be signed by a publisher you trust,
        limited to capabilities you granted, matched to the application version it was learned
        against — and withdrawable afterwards if it turns out to be harmful.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5 min-h-[24px] py-1">
          <input type="checkbox" checked={signed} onChange={(e) => setSigned(e.target.checked)} />
          Skill is signed
        </label>
        <label className="flex items-center gap-1.5 min-h-[24px] py-1">
          <input type="checkbox" checked={revoked} onChange={(e) => setRevoked(e.target.checked)} />
          Publisher has withdrawn it
        </label>
        <label className="flex items-center gap-1.5 min-h-[24px] py-1">
          Application version
          <input
            className="w-20 rounded border border-border bg-background px-1.5 py-0.5"
            value={appVersion}
            onChange={(e) => setAppVersion(e.target.value)}
            aria-label="Observed application version"
          />
        </label>
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {CAPS.map((c) => (
          <label key={c} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={granted.includes(c)}
              onChange={(e) =>
                setGranted((g) => (e.target.checked ? [...g, c] : g.filter((x) => x !== c)))
              }
            />
            {c.replace(/_/g, " ")}
            {HIGH_RISK_CAPABILITIES.includes(c) ? " (high risk)" : ""}
          </label>
        ))}
      </div>

      <Button size="sm" className="mt-3" onClick={() => void check()}>
        Check this skill
      </Button>

      {verdict && (
        <p className="mt-3 flex items-start gap-1.5 rounded border border-border/70 p-2 text-xs">
          {verdict.trusted ? (
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <ShieldX className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          <span>
            {verdict.trusted
              ? `Allowed. ${verdict.evidence}${
                  verdict.needsApproval.length > 0
                    ? ` Confirm each use of: ${verdict.needsApproval.join(", ")}.`
                    : ""
                }`
              : `Refused (${verdict.refusal.replace(/_/g, " ")}) — ${verdict.reason}`}
          </span>
        </p>
      )}
    </GlassPanel>
  );
}
