import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Globe, ShieldAlert, ShieldCheck } from "lucide-react";
import { runResearchQuery, type ResearchRunResponse } from "@/lib/research.functions";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { cn } from "@/lib/utils";
import { rankSources, type SourceRecord } from "@/lib/research/source-ranking";
import { assessClaim, assessIncidentClaim, describeAssessment } from "@/lib/research/claim-check";

/**
 * Research judgment, shown working.
 *
 * The two examples are chosen because they are the cases where an agent most
 * commonly sounds authoritative and is wrong: apparent corroboration that is
 * really one wire story, and an "accident" inferred from a red traffic layer.
 *
 * Both run the real modules — the verdicts below are produced by the same code
 * the tests exercise, not written into the markup.
 */

const NOW = new Date();
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60000);

/** Four outlets, one agency: the syndication trap. */
const SYNDICATED: SourceRecord[] = [
  {
    id: "1",
    title: "Report",
    publisher: "The Daily",
    originator: "Agency",
    kind: "news",
    publishedAt: minutesAgo(30),
    retrievedAt: NOW,
  },
  {
    id: "2",
    title: "Report",
    publisher: "Evening Post",
    originator: "Agency",
    kind: "news",
    publishedAt: minutesAgo(25),
    retrievedAt: NOW,
  },
  {
    id: "3",
    title: "Report",
    publisher: "City Herald",
    originator: "Agency",
    kind: "news",
    publishedAt: minutesAgo(20),
    retrievedAt: NOW,
  },
  {
    id: "4",
    title: "Report",
    publisher: "Morning News",
    originator: "Agency",
    kind: "news",
    publishedAt: minutesAgo(15),
    retrievedAt: NOW,
  },
];

/** A traffic feed and nothing else: the inference trap. */
const TRAFFIC_ONLY: SourceRecord[] = [
  {
    id: "t",
    title: "Live traffic",
    publisher: "Live traffic layer",
    kind: "sensor",
    publishedAt: minutesAgo(2),
    retrievedAt: NOW,
  },
];

type Demo = "syndication" | "incident";

export function ResearchPanel() {
  const [demo, setDemo] = useState<Demo | null>(null);
  const runQuery = useServerFn(runResearchQuery);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<ResearchRunResponse | null>(null);

  /*
   * P21: a real research run, executed server-side.
   *
   * The pipeline (runResearch + createHttpSourceFetcher + ResearchCache +
   * the fallback planner) was complete and tested but reachable only from
   * tests. It runs on the server because the SSRF guard has to run where the
   * request is actually made — a guard in the browser protects nothing — and
   * because CORS would otherwise decide which sources "exist".
   */
  const runRealResearch = useCallback(async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = (await runQuery({
        data: {
          query: "What is the current UK guidance on flood warnings?",
          topic: "flooding",
          volatility: "daily",
          candidates: [
            {
              url: "https://www.gov.uk/check-flood-risk",
              title: "Check flood risk",
              publishedAt: null,
            },
            {
              url: "https://en.wikipedia.org/wiki/Flood_warning",
              title: "Flood warning",
              publishedAt: null,
            },
          ],
        },
      })) as ResearchRunResponse;
      setRunResult(res);
    } catch (e) {
      setRunResult({
        ok: false,
        reason: e instanceof Error ? e.message : "The research run could not be started.",
        allowedHosts: [],
      });
    } finally {
      setRunning(false);
    }
  }, [runQuery]);

  const syndication = assessClaim(
    {
      text: "The council has approved the new bridge.",
      topic: "local government",
      supporting: SYNDICATED,
    },
    NOW,
  );

  const incident = assessIncidentClaim(
    { kind: "accident", text: "a collision", location: "the ring road", sources: TRAFFIC_ONLY },
    NOW,
  );

  const ranking = rankSources(SYNDICATED, "local government", NOW);

  return (
    <GlassPanel className="p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Globe className="h-4 w-4" aria-hidden /> How OCADE weighs what it reads
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Fetching pages needs a network. Judging them doesn't — and that's where research goes wrong.
        These run the real code on the two cases that most often produce a confident, wrong answer.
      </p>

      <div className="mb-3 rounded border border-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void runRealResearch()} disabled={running}>
            {running ? "Researching…" : "Run a real research query"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Runs on the server. Only an allowlisted set of hosts can be reached.
          </span>
        </div>
        {runResult && (
          <div className="mt-2 text-xs">
            {runResult.ok ? (
              <p className="text-muted-foreground">
                Answered from {runResult.result.subAnswers?.length ?? 0} sub-question
                {(runResult.result.subAnswers?.length ?? 0) === 1 ? "" : "s"}.
              </p>
            ) : (
              <p className="text-muted-foreground">Refused: {runResult.reason}</p>
            )}
            {runResult.allowedHosts.length > 0 && (
              <p className="mt-0.5 text-muted-foreground">
                Reachable hosts: {runResult.allowedHosts.join(", ")}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={demo === "syndication" ? "default" : "ghost"}
          className="h-8"
          onClick={() => setDemo("syndication")}
        >
          Four outlets, one story
        </Button>
        <Button
          size="sm"
          variant={demo === "incident" ? "default" : "ghost"}
          className="h-8"
          onClick={() => setDemo("incident")}
        >
          Is that traffic an accident?
        </Button>
      </div>

      {demo === "syndication" ? (
        <div role="status" className="mt-3 rounded-lg border border-border/60 p-3 text-xs">
          <p className="font-medium text-foreground">
            Four sources look like corroboration. OCADE counts {syndication.independentSupport}.
          </p>
          <p className="mt-1 text-muted-foreground">{describeAssessment(syndication)}</p>
          {ranking.ok ? (
            <p className="mt-1.5 text-[11px] text-muted-foreground">{ranking.evidence}</p>
          ) : null}
        </div>
      ) : null}

      {demo === "incident" ? (
        <div
          role="status"
          className={cn(
            "mt-3 rounded-lg border p-3 text-xs",
            incident.ok
              ? "border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10"
              : "border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10",
          )}
        >
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            {incident.ok ? (
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
            )}
            {incident.ok ? "Reported by an official source" : "OCADE won't say that"}
          </p>
          <p className="mt-1 text-muted-foreground">
            {incident.ok ? incident.statement : incident.reason}
          </p>
          {/*
            The honest observation the data DOES support. A refusal with nothing
            to offer in its place leaves the user to reach for the inference
            themselves.
          */}
          {!incident.ok ? (
            <p className="mt-1.5 border-t border-border/60 pt-1.5 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">What it can say: </span>
              {incident.mayInsteadSay}
            </p>
          ) : null}
        </div>
      ) : null}
    </GlassPanel>
  );
}
