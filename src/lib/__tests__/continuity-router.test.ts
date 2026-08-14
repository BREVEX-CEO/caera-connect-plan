/**
 * The continuity rules, and the failure they exist to prevent.
 *
 * "Remember that I prefer short answers" is one verb, one object and no
 * ambiguity — and before these rules it went to a language model, which
 * frequently answered it in PROSE: "I'll remember that." Nothing was written
 * down, and the reply said it had been. That is the worst shape a bug can take
 * here, because the user has no way to tell it from success until a week later
 * when OCADE has forgotten.
 *
 * Kept in its own file rather than appended to `control-work-router.test.ts`
 * because that file is organised around four specific reported failures and
 * reads as a record of them. This is a different set of rules with a different
 * reason to exist, and merging the two would blur both.
 */

import { describe, expect, it } from "vitest";
import { routeDirect } from "@/lib/work/fast-router";
import { findTool } from "@/lib/agent/tool-registry";

describe("continuity is routed without a model", () => {
  it.each([
    ["remember that I prefer short answers", "I prefer short answers"],
    ["remember I am building OCADE", "I am building OCADE"],
    ["note that the demo is on Friday", "the demo is on Friday"],
    ["don't forget the API is rate limited", "the API is rate limited"],
  ])("routes %j to memory_remember", (request, fact) => {
    expect(routeDirect(request)?.calls[0]).toEqual({
      name: "memory_remember",
      arguments: { fact },
    });
  });

  it("does not store a reminder as a fact", () => {
    /*
     * "Remember to call mum at 18:00" is a REMINDER. Stored as a fact it is
     * recalled forever and fires never — which is the one failure mode where
     * doing something is worse than doing nothing.
     */
    expect(routeDirect("remember to call mum at 18:00")?.rule).not.toBe("memory.remember");
    expect(routeDirect("remind me to call mum at 18:00")?.calls[0]).toEqual({
      name: "reminder_set",
      arguments: { message: "call mum", when: "at 18:00" },
    });
  });

  it("refuses a reminder with no time rather than inventing one", () => {
    // A reminder that fires at a moment nobody chose is worse than one that
    // was never set: the user believes it is coming.
    expect(routeDirect("remind me to call mum")).toBeNull();
  });

  it.each([
    ["remind me to stretch in 20 minutes", "stretch", "in 20 minutes"],
    ["remind me to join the call at 9:30", "join the call", "at 9:30"],
    ["remind me to take the bins out tomorrow 07:00", "take the bins out", "tomorrow 07:00"],
  ])("routes %j with both arguments", (request, message, when) => {
    expect(routeDirect(request)?.calls[0]).toEqual({
      name: "reminder_set",
      arguments: { message, when },
    });
  });

  it("separates the user's name from the assistant's", () => {
    expect(routeDirect("my name is Alex")?.calls[0]).toEqual({
      name: "memory_identity",
      arguments: { userName: "Alex" },
    });
    expect(routeDirect("call me Alex")?.calls[0]).toEqual({
      name: "memory_identity",
      arguments: { userName: "Alex" },
    });
    // The other direction renames the ASSISTANT, and putting the wrong one in
    // `userName` would have OCADE greeting the user as "JARVIS" every morning.
    expect(routeDirect("your name is JARVIS")?.calls[0]).toEqual({
      name: "memory_identity",
      arguments: { assistantName: "JARVIS" },
    });
    expect(routeDirect("call yourself JARVIS")?.calls[0]).toEqual({
      name: "memory_identity",
      arguments: { assistantName: "JARVIS" },
    });
  });

  it("routes the briefing and the topic watcher", () => {
    expect(routeDirect("catch me up")?.calls[0]?.name).toBe("morning_briefing");
    expect(routeDirect("give me my briefing")?.calls[0]?.name).toBe("morning_briefing");
    expect(routeDirect("watch local AI models")?.calls[0]).toEqual({
      name: "topic_watch",
      arguments: { topic: "local AI models" },
    });
    expect(routeDirect("anything new")?.calls[0]?.name).toBe("topic_check");
  });

  it("does not turn 'watch my screen' into a news topic", () => {
    // The watcher searches the web once a day. Handed "my screen" it would
    // dutifully follow headlines about screens, forever.
    expect(routeDirect("watch my screen")?.rule).not.toBe("presence.watch");
  });
});

describe("the rest of the machine is routed without a model", () => {
  it("routes weather, with and without a city", () => {
    expect(routeDirect("what's the weather")?.calls[0]).toEqual({
      name: "weather",
      arguments: {},
    });
    expect(routeDirect("what's the weather in Bengaluru")?.calls[0]).toEqual({
      name: "weather",
      arguments: { city: "Bengaluru" },
    });
  });

  it("lets an explicit web search beat the weather rule", () => {
    // "search for weather apps" is a search. Answering it by reading today's
    // forecast is the same class of mistake as answering "google cpu usage in
    // linux" by reading this computer's processor load.
    expect(routeDirect("search for weather apps")?.rule).toBe("web.search");
  });

  it("routes brightness, wifi and the clipboard", () => {
    expect(routeDirect("set the brightness to 40")?.calls[0]).toEqual({
      name: "system_brightness",
      arguments: { action: "set", percent: 40 },
    });
    expect(routeDirect("which network am I on")?.calls[0]?.name).toBe("system_wifi");
    expect(routeDirect("what did I just copy")?.calls[0]?.name).toBe("clipboard_read");
  });

  it("routes the reversible power actions and leaves the irreversible ones alone", () => {
    expect(routeDirect("lock the computer")?.calls[0]).toEqual({
      name: "system_power",
      arguments: { action: "lock" },
    });
    expect(routeDirect("go to sleep")?.calls[0]).toEqual({
      name: "system_power",
      arguments: { action: "sleep" },
    });
    /*
     * SHUTDOWN AND RESTART ARE NOT ON THE FAST PATH, ON PURPOSE. Every other
     * rule here is instant because it is reversible. Those two close somebody's
     * unsaved work with no undo, so they go through the model and the approval
     * gate — a few seconds is the cheapest insurance in the file.
     */
    expect(routeDirect("shut down the computer")).toBeNull();
    expect(routeDirect("restart the computer")).toBeNull();
  });

  it("routes the webcam but not an ordinary look at the screen", () => {
    expect(routeDirect("what can you see on my webcam")?.calls[0]).toEqual({
      name: "see",
      arguments: { source: "webcam" },
    });
    // The screen still goes to `screen_observe`, which reads the accessibility
    // tree in milliseconds. Routing it to the vision model would make the most
    // common observation in the product ten times slower.
    expect(routeDirect("what's on my screen")?.calls[0]?.name).toBe("screen_observe");
  });

  it("routes games and the phone dashboard", () => {
    expect(routeDirect("which games need updating")?.calls[0]?.name).toBe("game_list");
    expect(routeDirect("pair my phone")?.calls[0]).toEqual({
      name: "phone_dashboard",
      arguments: { action: "start" },
    });
  });

  it("routes autostart in both directions", () => {
    expect(routeDirect("start with windows")?.calls[0]).toEqual({
      name: "autostart",
      arguments: { enable: "yes" },
    });
    expect(routeDirect("don't start with windows")?.calls[0]).toEqual({
      name: "autostart",
      arguments: { enable: "no" },
    });
  });

  it("names a real registered tool in every rule it fires", () => {
    /*
     * THE JOIN THAT BREAKS SILENTLY. A router rule naming a tool that is not in
     * the registry produces "There is no tool called x" — after the fast path
     * has already told the user what it was about to do.
     */
    const requests = [
      "remember that I like tea",
      "forget about tea",
      "my name is Alex",
      "your name is JARVIS",
      "catch me up",
      "watch quantum computing",
      "anything new",
      "remind me to stretch in 20 minutes",
      "list my reminders",
      "what's the weather",
      "what can you see on my webcam",
      "lock the computer",
      "set the brightness to 40",
      "which network am I on",
      "what did I just copy",
      "which games need updating",
      "pair my phone",
      "start with windows",
      "what do you remember about me",
    ];
    for (const request of requests) {
      const route = routeDirect(request);
      expect(route, `${request} should route`).not.toBeNull();
      for (const call of route?.calls ?? []) {
        expect(
          findTool(call.name),
          `${request} names an unregistered tool: ${call.name}`,
        ).not.toBeNull();
      }
    }
  });
});
