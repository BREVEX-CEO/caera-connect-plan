import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { runAgentTask } from "@/lib/agent/loop";
import { recoveryBrief } from "@/lib/work/use-mission";
import type { ToolOutcome } from "@/lib/agent/outcomes";

/**
 * WHAT HAPPENS WHEN THE RULES RUN OUT.
 *
 * The reported failure, in full: "open whatsapp and search for Meta ai and ask
 * a question about anything computer related". The router typed a name into
 * WhatsApp's search box, WhatsApp answered "No chats, contacts or messages
 * found", and OCADE repeated that sentence back and stopped.
 *
 * Nothing was broken in the sense of throwing. The fast path did exactly what
 * it was built to do and came up short, and there was no next step — no look at
 * the screen, no second attempt, no use of the vision model, the accessibility
 * tree or the OCR search that were all installed and idle. A person would have
 * glanced at the window.
 *
 * These tests cover the handover that now exists, in three parts: the brief
 * that is written, the loop's willingness to be told which tools it needs
 * rather than guessing, and the wiring between them.
 */

const MISSION = readFileSync("src/lib/work/use-mission.ts", "utf8");

describe("a failed fast path hands over instead of stopping", () => {
  it("tells the model what was tried and what came back", () => {
    /*
     * "It failed" is not something anybody can act on. The brief carries the
     * original request, the step that failed, and the ACTUAL message — because
     * "No chats, contacts or messages found" is the piece that tells a model
     * the search ran and matched nothing, rather than that WhatsApp never
     * opened.
     */
    const brief = recoveryBrief(
      "open whatsapp and search for Meta ai",
      "Finding the conversation",
      "No chats, contacts or messages found.",
    );
    expect(brief).toContain("open whatsapp and search for Meta ai");
    expect(brief).toContain("Finding the conversation");
    expect(brief).toContain("No chats, contacts or messages found.");
  });

  it("names the tools that can see, because the model has to pick one", () => {
    const brief = recoveryBrief("do a thing", "A step", "It did not work.");
    expect(brief).toContain("screen_observe");
    expect(brief).toContain("screen_find");
    expect(brief).toContain("see");
  });

  it("does not tell the model to try the same thing again", () => {
    /*
     * The one instruction that is always wrong here. A search that matched
     * nothing will match nothing a second time, and a retry loop looks
     * identical to a hang from the outside.
     */
    const brief = recoveryBrief("do a thing", "A step", "It did not work.");
    expect(brief).toMatch(/not repeat that attempt unchanged/i);
    // And it must not bounce the problem back to the user, which is the other
    // way a run ends with nothing done.
    expect(brief).toMatch(/not ask the user what to do/i);
  });
});

describe("the loop can be told its domains instead of classifying", () => {
  const outcome: ToolOutcome = { kind: "success", detail: "done", verified: true };

  /** Deps whose classifier FAILS if it is ever consulted. */
  const deps = (seen: { tools: string[] }) => ({
    complete: async () => {
      throw new Error("classification must not run for a caller-supplied domain list");
    },
    turn: async (_messages: unknown, tools: { function: { name: string } }[]) => {
      seen.tools = tools.map((t) => t.function.name);
      return { text: "Looked at the screen.", toolCalls: [] };
    },
    execute: async () => outcome,
    permit: async () => true,
  });

  it("skips classification entirely when the caller supplies domains", async () => {
    /*
     * Not a style preference. `classify` degrades to `conversation` when the
     * model is unreachable, and `conversation` carries NO TOOLS — so on a
     * flaky engine the recovery became OCADE describing what it would have
     * done. The throwing `complete` above is the assertion: reaching it at all
     * is the bug.
     */
    const seen = { tools: [] as string[] };
    const result = await runAgentTask(deps(seen), {
      request: "look at the screen and carry on",
      domains: ["os_app"],
    });
    expect(result.classification.basis).toBe("caller");
    expect(result.classification.domains).toEqual(["os_app"]);
  });

  it("loads the tools that can actually observe the screen", async () => {
    // The whole point of the handover. If these are missing, the model is
    // being asked to look with nothing to look through.
    const seen = { tools: [] as string[] };
    await runAgentTask(deps(seen), {
      request: "look at the screen and carry on",
      domains: ["os_app"],
    });
    expect(seen.tools).toContain("screen_observe");
    expect(seen.tools).toContain("screen_find");
    expect(seen.tools).toContain("see");
  });

  it("still classifies when no domains are given", async () => {
    // The override must stay the exception. Every caller passing a human's
    // words gets the behaviour it always had.
    const seen = { tools: [] as string[] };
    const result = await runAgentTask(
      {
        ...deps(seen),
        complete: async () => '{"domains":["conversation"]}',
      },
      { request: "how are you" },
    );
    expect(result.classification.basis).not.toBe("caller");
  });
});

describe("the mission wires the handover to the failure", () => {
  /*
   * Source-read, because observing this by running the hook means standing up
   * a browser, a mission and a sidecar to watch one assignment happen. The
   * risk being guarded is deletion, and a source assertion catches that.
   */
  it("turns the first failed direct call into a recovery brief", () => {
    expect(MISSION).toContain("remainingWork = recoveryBrief(request, failed.call, failed.detail)");
  });

  it("only escalates when nothing else was already queued", () => {
    // A run that already has a remainder or a writing brief has somewhere to
    // go; replacing it would drop the work the user asked for.
    expect(MISSION).toContain(
      "const escalating = Boolean(failed) && !remainingWork && !pendingCompose",
    );
  });

  it("hands the recovery its domains rather than letting it be classified", () => {
    expect(MISSION).toMatch(/recovering \? \{ domains: \["os_app", "files", "web"\]/);
  });

  it("keeps the first failure, not the last", () => {
    // Later calls in a batch usually fail *because* the first one did, so the
    // first is the one that explains anything.
    expect(MISSION).toContain("if (!failed) failed =");
  });
});
