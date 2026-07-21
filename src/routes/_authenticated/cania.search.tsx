import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { SetupRequiredState } from "@/components/shell/SetupRequiredState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CANIA_SECTIONS } from "@/lib/cania-sections";
import { providersForSection } from "@/lib/cania-providers";

export const Route = createFileRoute("/_authenticated/cania/search")({
  head: () => ({ meta: [{ title: "CANIA · Search" }, { name: "robots", content: "noindex" }] }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const eligible = CANIA_SECTIONS.filter(
    (s) => !s.adminOnly && s.slug !== "" && providersForSection(s.id).length > 0,
  );
  return (
    <div className="flex flex-col gap-4">
      <GlassPanel className="p-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = q.trim();
            setSubmitted(v ? v : null);
          }}
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search across every CANIA section…"
          />
          <Button type="submit">
            <SearchIcon className="mr-1.5 h-4 w-4" /> Search
          </Button>
        </form>
      </GlassPanel>
      {submitted ? (
        <SetupRequiredState
          title={`No providers connected — cannot search "${submitted}"`}
          description={`Cross-section search will query these ${eligible.length} sections once their provider adapters are connected. Until then, CANIA will not return fabricated results.`}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          Enter a query to search across {eligible.length} sections. Each section returns results only from its connected provider adapters.
        </p>
      )}
    </div>
  );
}
