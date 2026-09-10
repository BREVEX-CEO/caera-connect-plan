/**
 * OCADE keeping something it was never told to keep.
 *
 * Two failures matter here and they pull in opposite directions: never learning
 * anything (the state before this existed), and learning constantly — which
 * costs a model call per turn and fills recall with noise until the two useful
 * facts are unfindable. The thresholds are what hold the middle, so they are
 * what these tests pin.
 */

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

import {
  considerSessionMemory,
  extractionPrompt,
  noteWork,
  parseExtracted,
  resetSessionMemory,
} from "../session-memory";
import {
  createSessionMemoryState,
  DEFAULT_SESSION_MEMORY_CONFIG,
  shouldExtract,
} from "@/primary-logic/memory/sessionMemoryPolicy";

afterEach(() => resetSessionMemory());

const transcript = [
  { role: "user", content: "I keep all my invoices in a folder called Ledger." },
  { role: "assistant", content: "Noted." },
];

function depsThatSay(reply: string | null) {
  const saved: string[] = [];
  return {
    saved,
    deps: {
      complete: async () => reply,
      // Async, because both reach the account: what is already remembered is
      // read from it, and a new fact is written to it.
      existing: async () => [],
      save: async (content: string) => {
        saved.push(content);
        return true;
      },
    },
  };
}

describe("when an extraction happens at all", () => {
  it("says nothing until the conversation is worth summarising", async () => {
    const { deps, saved } = depsThatSay("- They keep invoices in a folder called Ledger.");
    const facts = await considerSessionMemory("chat", { tokenCount: 200, transcript, deps });
    expect(facts).toEqual([]);
    expect(saved).toEqual([]);
  });

  it("extracts once the conversation has grown past the floor", async () => {
    const { deps, saved } = depsThatSay("- They keep invoices in a folder called Ledger.");
    const facts = await considerSessionMemory("chat", { tokenCount: 12_000, transcript, deps });
    expect(facts).toEqual(["They keep invoices in a folder called Ledger."]);
    expect(saved).toHaveLength(1);
  });

  it("does not extract again on the very next turn", async () => {
    const first = depsThatSay("- They keep invoices in a folder called Ledger.");
    await considerSessionMemory("chat", { tokenCount: 12_000, transcript, deps: first.deps });

    const second = depsThatSay("- Something else entirely.");
    // Grown a little, and no work done: neither condition is met.
    const facts = await considerSessionMemory("chat", {
      tokenCount: 13_000,
      transcript,
      deps: second.deps,
    });
    expect(facts).toEqual([]);
  });

  it("extracts again after real growth AND real work", async () => {
    const first = depsThatSay("- They keep invoices in a folder called Ledger.");
    await considerSessionMemory("chat", { tokenCount: 12_000, transcript, deps: first.deps });

    noteWork("chat", 3);
    const second = depsThatSay("- Their accountant is called Priya.");
    const facts = await considerSessionMemory("chat", {
      tokenCount: 20_000,
      transcript,
      deps: second.deps,
    });
    expect(facts).toEqual(["Their accountant is called Priya."]);
  });

  it("keeps separate books for Chat and Cowork", async () => {
    const chat = depsThatSay("- One fact about how they work.");
    await considerSessionMemory("chat", { tokenCount: 12_000, transcript, deps: chat.deps });
    const work = depsThatSay("- Another fact about how they work.");
    const facts = await considerSessionMemory("control", {
      tokenCount: 12_000,
      transcript,
      deps: work.deps,
    });
    expect(facts).toEqual(["Another fact about how they work."]);
  });

  it("leaves the thresholds alone when the engine could not answer", async () => {
    const failed = depsThatSay(null);
    expect(
      await considerSessionMemory("chat", { tokenCount: 12_000, transcript, deps: failed.deps }),
    ).toEqual([]);
    const retry = depsThatSay("- They keep invoices in a folder called Ledger.");
    expect(
      await considerSessionMemory("chat", { tokenCount: 12_000, transcript, deps: retry.deps }),
    ).toHaveLength(1);
  });

  it("survives an extractor that throws", async () => {
    const facts = await considerSessionMemory("chat", {
      tokenCount: 12_000,
      transcript,
      deps: {
        complete: async () => {
          throw new Error("engine fell over");
        },
        existing: async () => [],
        save: async () => true,
      },
    });
    expect(facts).toEqual([]);
  });
});

describe("what survives the filter", () => {
  it("treats NOTHING as the normal answer it is", () => {
    expect(parseExtracted("NOTHING")).toEqual([]);
    expect(parseExtracted("- Nothing worth keeping here")).toEqual([]);
  });

  it("drops anything that reads as true only today", () => {
    expect(parseExtracted("- They are currently working on the Ledger folder.")).toEqual([]);
  });

  it("drops what OCADE could look up instead", () => {
    expect(parseExtracted("- The file contains twelve invoices.")).toEqual([]);
  });

  it("does not save the same fact twice", () => {
    expect(parseExtracted("- They prefer short replies.", ["They prefer short replies."])).toEqual(
      [],
    );
  });

  it("keeps at most three, however many it is offered", () => {
    const reply = [
      "- Their accountant is called Priya.",
      "- Their business partner is called Sam.",
      "- Their bank is Barclays.",
      "- Their landlord is called Ade.",
    ].join("\n");
    expect(parseExtracted(reply)).toHaveLength(3);
  });

  it("ignores the model restating its own brief", () => {
    expect(parseExtracted("Rules: one fact per line\n- Their bank is Barclays.")).toEqual([
      "Their bank is Barclays.",
    ]);
  });
});

describe("the prompt", () => {
  it("asks for durable facts and offers an easy way out", () => {
    const prompt = extractionPrompt(transcript);
    expect(prompt).toContain("still be true next week");
    expect(prompt).toContain("NOTHING");
    expect(prompt).toContain("Ledger");
  });

  it("never names an engine, a model or a file format", () => {
    expect(extractionPrompt(transcript)).not.toMatch(/qwen|webgpu|wasm|gguf/i);
  });
});

describe("the imported policy itself", () => {
  it("needs both growth and work after the first extraction", () => {
    const state = {
      ...createSessionMemoryState(),
      initialized: true,
      tokensAtLastExtraction: 10_000,
      toolCallsSinceExtraction: 0,
    };
    const grown = 10_000 + DEFAULT_SESSION_MEMORY_CONFIG.minimumTokensBetweenUpdates;
    expect(shouldExtract(state, grown)).toBe(false);
    expect(
      shouldExtract(
        {
          ...state,
          toolCallsSinceExtraction: DEFAULT_SESSION_MEMORY_CONFIG.toolCallsBetweenUpdates,
        },
        grown,
      ),
    ).toBe(true);
  });

  it("will not start a second extraction while one is running", () => {
    const state = { ...createSessionMemoryState(), extracting: true };
    expect(shouldExtract(state, 1_000_000)).toBe(false);
  });
});

describe("where an inferred memory says it came from", () => {
  const runtime = readFileSync("src/lib/runtime/use-ocade-runtime.ts", "utf8");

  it("records what OCADE worked out as inferred, not as imported", () => {
    /*
     * The three sources mean three different things to the person reading the
     * review list: `user` is what they typed, `imported` is what they brought
     * in from another product, and `inferred` is what OCADE decided to keep on
     * its own. Session extraction wrote "imported", so Privacy settings told
     * everybody who looked that they had imported facts they had never seen.
     *
     * The list prints the value verbatim, which is why this is a correctness
     * bug and not a wording one.
     */
    const learn = runtime.slice(runtime.indexOf("const learn = useCallback"));
    const save = learn.slice(learn.indexOf("save: async (content)"));
    expect(save).toContain('source: "inferred"');
    expect(save).not.toContain('source: "imported"');
  });

  it("still refuses to learn anything from an incognito conversation", () => {
    // The guard sits before the counter, because the counter is itself a
    // record of the conversation having happened.
    const learn = runtime.slice(runtime.indexOf("const learn = useCallback"));
    const guard = learn.indexOf("mayRemember(");
    const counter = learn.indexOf("noteWork(");
    expect(guard).toBeGreaterThan(-1);
    expect(counter).toBeGreaterThan(guard);
  });
});
