/**
 * WHICH QUESTIONS NEED THE NETWORK, AND WHICH MUST NEVER TOUCH IT.
 *
 * Two failures matter here and they pull in opposite directions.
 *
 * Answering a question about today from training data, confidently, is the
 * one the product cannot ship: it reads exactly like a correct answer and the
 * person has no way to tell. That is the hallucination this router exists to
 * prevent.
 *
 * Reaching for the network on "what is 17 times 4" is the other, and on a
 * product sold on nothing leaving the device it is arguably worse. So
 * "unknown" routes to the local model: retrieval happens on evidence, never on
 * suspicion.
 */
import { describe, expect, it } from "vitest";
import { classifyFreshness, routeForFreshness } from "../freshness";

const NOW = new Date("2026-08-23T00:00:00Z");

describe("questions that depend on what day it is", () => {
  for (const question of [
    "What is the latest version of Node?",
    "Who won the match yesterday?",
    "What is the weather in Bengaluru?",
    "What is the current price of gold?",
    "Any news about the merger?",
    "What is the exchange rate for the rupee today?",
    "Who is the president of France?",
    "What are the scores so far this week?",
    "Is GitHub down right now?",
  ]) {
    it(`routes to research: ${question}`, () => {
      expect(classifyFreshness(question, NOW).freshness).toBe("time_sensitive");
    });
  }

  it("explains itself with a phrase from the question, not a guess", () => {
    const verdict = classifyFreshness("What is the latest release?", NOW);
    expect(verdict.because).toContain("latest");
  });
});

describe("questions that do not", () => {
  for (const question of [
    "What is 17 multiplied by 4?",
    "Define entropy.",
    "How do I reverse a list in Python?",
    "Explain why the sky is blue.",
    "Translate 'good morning' into Japanese.",
    "What is the capital of Australia?",
    "Summarise this paragraph for me.",
    "Write me a polite decline to a meeting invitation.",
  ]) {
    it(`answers on the device: ${question}`, () => {
      expect(classifyFreshness(question, NOW).freshness).not.toBe("time_sensitive");
    });
  }

  it("treats a finished year as history rather than news", () => {
    expect(classifyFreshness("Who won the 2016 US election?", NOW).freshness).toBe("timeless");
  });

  it("does not let a past year rescue a question about now", () => {
    // "latest" wins: asking for the newest thing is a question about today
    // however many years are mentioned in passing.
    expect(classifyFreshness("Since 2019, what is the latest guidance?", NOW).freshness).toBe(
      "time_sensitive",
    );
  });

  it("does not fire on words that merely contain a trigger", () => {
    for (const question of [
      "Explain concurrent execution.",
      "What does translated mean in this context?",
      "Describe the currency of Japan.",
    ]) {
      expect(classifyFreshness(question, NOW).freshness, question).not.toBe("time_sensitive");
    }
  });

  it("says unknown rather than guessing, and unknown does not reach the network", () => {
    const verdict = classifyFreshness("Bananas.", NOW);
    expect(verdict.freshness).toBe("unknown");
    expect(
      routeForFreshness("Bananas.", { online: true, researchAllowed: true, now: NOW }).research,
    ).toBe(false);
  });

  it("says nothing at all about an empty question", () => {
    expect(classifyFreshness("   ", NOW).freshness).toBe("unknown");
  });
});

describe("being offline is answered honestly, not as a failure", () => {
  const question = "What is the latest version of Node?";

  it("looks it up when online and allowed", () => {
    const routing = routeForFreshness(question, {
      online: true,
      researchAllowed: true,
      now: NOW,
    });
    expect(routing.research).toBe(true);
    expect(routing.notice).toBeNull();
  });

  it("still answers offline, and says the live part could not be checked", () => {
    const routing = routeForFreshness(question, {
      online: false,
      researchAllowed: true,
      now: NOW,
    });
    expect(routing.research).toBe(false);
    expect(routing.notice).toMatch(/offline/i);
    expect(routing.notice).toMatch(/could not verify|out of date/i);
  });

  it("says so when looking things up is switched off", () => {
    const routing = routeForFreshness(question, {
      online: true,
      researchAllowed: false,
      now: NOW,
    });
    expect(routing.research).toBe(false);
    expect(routing.notice).toMatch(/switched off/i);
  });

  it("stays silent about questions that never needed the network", () => {
    const routing = routeForFreshness("What is 17 multiplied by 4?", {
      online: false,
      researchAllowed: true,
      now: NOW,
    });
    expect(routing.research).toBe(false);
    expect(routing.notice).toBeNull();
  });
});
