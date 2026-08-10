import { describe, expect, it } from "vitest";
import { directControl, requireText, routeDirect } from "@/lib/work/fast-router";
import { TaskLedger, checkCall, validateArguments } from "@/lib/work/tool-contract";
import { findTool } from "@/lib/agent/tool-registry";
import { parseModelReply, stripControlTokens } from "@/lib/work/tool-protocol";

/**
 * The fast path, and the four failures it was built around.
 *
 * Every case in the "reported failures" block below is a thing that actually
 * happened on this machine, in the Demo GUI, in front of a person. They are
 * written as tests rather than as fixes-with-a-comment because each one is a
 * class of mistake that will come back the moment somebody relaxes a rule:
 *
 *   - a blank YouTube search that reported success
 *   - a browser opened three times for one task
 *   - a Google challenge page read as search results
 *   - "stop" taking eleven seconds because it went to a language model first
 *
 * The blank-Notepad false success is the fifth, and it is pinned in the Python
 * suite (`test_desktop_voice.py`) because the check that catches it is the
 * readback in the host.
 */

describe("the router answers the unambiguous things itself", () => {
  it("routes the control words instantly and exactly", () => {
    for (const word of ["stop", "Stop.", "cancel", "abort", "that's enough"]) {
      expect(directControl(word)).toBe("stop");
    }
    for (const word of ["pause", "hold on", "wait"]) expect(directControl(word)).toBe("pause");
    for (const word of ["continue", "resume", "carry on", "keep going"]) {
      expect(directControl(word)).toBe("continue");
    }
  });

  it("does not mistake a sentence containing a control word for a control", () => {
    // "stop the video" is a media action, and "stop" is a stop. Getting this
    // wrong either ignores an emergency or halts a task nobody wanted halted.
    expect(directControl("stop the video")).toBeNull();
    expect(directControl("tell me how to stop a running process")).toBeNull();
    expect(routeDirect("stop the video")?.calls[0]?.name).toBe("browser_media");
  });

  it("reads the screen, the windows, the system and the displays", () => {
    const cases: [string, string][] = [
      ["what's on my screen", "screen_observe"],
      ["what do you see", "screen_observe"],
      ["what windows are open", "window_list"],
      ["system status", "system_status"],
      ["how many monitors do I have", "display_list"],
      ["what applications are installed", "app_list_installed"],
    ];
    for (const [request, tool] of cases) {
      expect(routeDirect(request)?.calls[0]?.name, request).toBe(tool);
    }
  });

  it("opens and focuses applications it recognises", () => {
    const open = routeDirect("open notepad");
    expect(open?.calls[0]).toEqual({ name: "app_open", arguments: { name: "notepad" } });
    const focus = routeDirect("switch to chrome");
    expect(focus?.calls[0]).toEqual({ name: "app_focus", arguments: { name: "chrome" } });
  });

  it("leaves anything it does not recognise to the model", () => {
    // The bar is "cannot reasonably mean anything else". A rule that fires on
    // 95% of phrasings does the wrong thing on the other 5%, and the wrong
    // thing here moves somebody's mouse.
    expect(routeDirect("open the report I was working on yesterday")).toBeNull();
    expect(routeDirect("tidy up my desktop")).toBeNull();
    expect(routeDirect("book me a table for two")).toBeNull();
    expect(routeDirect("")).toBeNull();
  });

  it("scrolls, lists tabs and controls media", () => {
    expect(routeDirect("scroll down")?.calls[0]?.arguments).toEqual({ direction: "down" });
    expect(routeDirect("scroll up")?.calls[0]?.arguments).toEqual({ direction: "up" });
    expect(routeDirect("what tabs are open")?.calls[0]?.name).toBe("browser_tabs");
    expect(routeDirect("pause the video")?.calls[0]?.arguments).toEqual({ action: "pause" });
    expect(routeDirect("mute the video")?.calls[0]?.arguments).toEqual({ action: "mute" });
  });
});

describe("the four reported failures", () => {
  /* ---------------------------------------------- 1. blank YouTube query -- */
  it("never turns an empty YouTube phrase into a blank search", () => {
    // The live bug: `youtube.com/results?search_query=` with nothing after the
    // equals sign, and OCADE reporting that it had searched.
    for (const request of [
      "search youtube for",
      "youtube",
      "search youtube for .",
      "on youtube:",
    ]) {
      const route = routeDirect(request);
      const query = route?.calls[0]?.arguments?.query;
      expect(query, request).toBeUndefined();
    }
  });

  it("routes a real YouTube search with the query intact", () => {
    for (const request of [
      "search youtube for lofi beats",
      "play lofi beats on youtube",
      "on youtube, find lofi beats",
    ]) {
      const route = routeDirect(request);
      expect(route?.calls[0]?.name, request).toBe("youtube_search");
      expect(route?.calls[0]?.arguments?.query, request).toBe("lofi beats");
    }
  });

  it("treats “open YouTube” as opening the site, not as an empty search", () => {
    const route = routeDirect("open youtube");
    expect(route?.calls[0]?.name).toBe("browser_navigate");
    expect(String(route?.calls[0]?.arguments?.url)).toContain("youtube.com");
  });

  it("refuses an empty required argument at the contract, whatever produced it", () => {
    const tool = findTool("youtube_search")!;
    expect(validateArguments(tool, { query: "" }).ok).toBe(false);
    expect(validateArguments(tool, { query: "   " }).ok).toBe(false);
    expect(validateArguments(tool, {}).ok).toBe(false);
    expect(validateArguments(tool, { query: "lofi beats" }).ok).toBe(true);

    const verdict = checkCall({ name: "youtube_search", arguments: { query: "" } });
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.code).toBe("bad_arguments");
    // The reason goes back to the model, so it can correct itself next turn.
    expect(verdict.ok === false && verdict.reason).toMatch(/needs query/i);
  });

  /* --------------------------------------------- 2. repeated browser open -- */
  it("refuses the same action twice in one task", () => {
    const ledger = new TaskLedger();
    const call = { name: "browser_open", arguments: { browser: "chrome" } };
    const first = checkCall(call, ledger);
    expect(first.ok).toBe(true);
    ledger.note(first.ok ? first.call : call);

    const second = checkCall(call, ledger);
    expect(second.ok).toBe(false);
    expect(second.ok === false && second.code).toBe("repeated");
    expect(second.ok === false && second.reason).toMatch(/already done/i);
  });

  it("still allows repeated observation, which verification depends on", () => {
    // Blocking a second `screen_observe` would break observe → act → observe.
    const ledger = new TaskLedger();
    const look = { name: "screen_observe", arguments: {} };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const verdict = checkCall(look, ledger);
      expect(verdict.ok).toBe(true);
      ledger.note(look);
    }
  });

  it("lets the same action run again in a LATER task", () => {
    // Twice in one instruction is a loop. Twice across two instructions is a
    // person asking again, which is allowed.
    const ledger = new TaskLedger();
    const call = { name: "app_open", arguments: { name: "notepad" } };
    ledger.note(call);
    expect(checkCall(call, ledger).ok).toBe(false);
    ledger.reset();
    expect(checkCall(call, ledger).ok).toBe(true);
  });

  /* ------------------------------- 5. an engine control token as an argument -- */
  it("never accepts a runtime control directive as a real value", () => {
    // Observed: asked to "search youtube for" with no term, the model emitted a
    // call whose query was the literal string "/no_think" — a Qwen switch meant
    // for the runtime — and OCADE searched YouTube for it.
    const verdict = checkCall({ name: "youtube_search", arguments: { query: "/no_think" } });
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toMatch(/control token/i);

    // And it is removed before the reply is even parsed.
    expect(stripControlTokens("Sure /no_think")).toBe("Sure");
    const parsed = parseModelReply(
      '/no_think {"tool":"youtube_search","arguments":{"query":"lofi"}}',
      ["youtube_search"],
    );
    expect(parsed.toolCalls[0]?.arguments).toEqual({ query: "lofi" });
  });

  /* ------------------------------------------------ 3. Google / CAPTCHA -- */
  it("searches through a source that answers, not one that challenges", () => {
    // Google serves an interstitial to automated traffic. The fix is not to
    // defeat it — it is to use a search path that does not demand one.
    const route = routeDirect("google the capital of iceland");
    expect(route?.calls[0]?.name).toBe("web_search");
    expect(route?.calls[0]?.arguments?.query).toBe("the capital of iceland");
  });

  it("does not search on an empty query however it was phrased", () => {
    for (const request of ["search", "google", "look up", "search the web for"]) {
      expect(routeDirect(request), request).toBeNull();
    }
  });

  /* ------------------------------------------------------ 4. slow stop -- */
  it("resolves a control word without any tool call at all", () => {
    const route = routeDirect("stop");
    expect(route?.control).toBe("stop");
    expect(route?.calls).toHaveLength(0);
  });
});

describe("argument hygiene", () => {
  it("keeps only real text", () => {
    expect(requireText("  lofi   beats ")).toBe("lofi beats");
    expect(requireText('"quoted"')).toBe("quoted");
    expect(requireText("")).toBeNull();
    expect(requireText("   ")).toBeNull();
    expect(requireText("...")).toBeNull();
    expect(requireText(undefined)).toBeNull();
  });

  it("rejects an enum value that is not in the enum", () => {
    const tool = findTool("browser_media")!;
    expect(validateArguments(tool, { action: "rewind" }).ok).toBe(false);
    expect(validateArguments(tool, { action: "play" }).ok).toBe(true);
  });

  it("drops a stray argument rather than refusing the whole call", () => {
    // A model adding a `reason` field is being chatty, not dangerous, and
    // losing a step over it costs the user time for nothing.
    const tool = findTool("app_open")!;
    const result = validateArguments(tool, { name: "notepad", reason: "because" });
    expect(result.ok).toBe(true);
    expect(result.ok && result.arguments).toEqual({ name: "notepad" });
  });

  it("refuses a tool that does not exist", () => {
    const verdict = checkCall({ name: "shell_execute", arguments: {} });
    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.code).toBe("unknown_tool");
  });
});
