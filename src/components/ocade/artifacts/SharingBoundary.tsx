import { Link } from "@tanstack/react-router";
import { Share2 } from "lucide-react";
import { CapabilityBadge } from "@/components/capability/CapabilityBadge";

/**
 * WHAT CAN LEAVE THIS ACCOUNT, AND WHAT CANNOT.
 *
 * `PLAN.md` §4 folded the Shared page into Artifacts. That page said "this
 * build has no public-share link service", which stopped being true when Chat
 * gained revocable, expiring share links — so the consolidation also fixes a
 * claim that had quietly become false.
 *
 * The boundary as it actually stands: a conversation can be shared from Chat,
 * as a frozen copy behind a link its owner can revoke. An artifact cannot;
 * there is no share token, public URL or anonymous read path for one, and
 * OCADE does not offer a control that implies otherwise.
 */

export function SharingBoundary() {
  return (
    <section
      aria-labelledby="artifacts-sharing"
      className="mt-8 rounded-xl border border-border/60 bg-card/30 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 id="artifacts-sharing" className="text-sm font-medium text-foreground">
            Sharing an artifact
          </h2>
        </div>
        <CapabilityBadge status="NOT_CONFIGURED" />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        There is no share token, public URL or anonymous read path for an artifact, so nothing here
        is published merely because it exists. Downloading a copy is the way to send one on.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        A <em>conversation</em> can be shared:{" "}
        <Link to="/ocade" className="text-foreground underline underline-offset-4">
          Chat
        </Link>{" "}
        issues a link to a frozen copy, with an expiry, and you can revoke it.
      </p>
    </section>
  );
}
