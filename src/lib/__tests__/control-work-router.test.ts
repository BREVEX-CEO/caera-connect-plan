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
    // "play lofi beats on youtube" USED TO BE IN THIS LIST, and that was the
    // bug rather than the spec: a play verb now routes to `youtube_play`,
    // which opens the first result and skips the advert. Searching was never
    // what "play" asked for.
    for (const request of ["search youtube for lofi beats", "on youtube, find lofi beats"]) {
      const route = routeDirect(request);
      expect(route?.calls[0]?.name, request).toBe("youtube_search");
      expect(route?.calls[0]?.arguments?.query, request).toBe("lofi beats");
    }
    const played = routeDirect("play lofi beats on youtube");
    expect(played?.calls[0]?.name).toBe("youtube_play");
    expect(played?.calls[0]?.arguments?.query).toBe("lofi beats");
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
    expect(route?.calls[0]?.name).toBe("parallel_search");
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

/**
 * The compound-sentence bug, and the consolidation that followed it.
 *
 * FOUND BY A LIVE RUN, not by review. Asked to "Open Notepad and write a
 * 200-word essay about fast cars", the router returned
 *
 *     app_open({ name: "Notepad and write a 200-word essay about fast cars" })
 *
 * and reported success. OCADE tried to launch a program with that name, the
 * model was never consulted, and the essay was never written. The failure was
 * silent — every mechanical check passed, because the router genuinely did what
 * it decided to do.
 */
describe("a compound instruction keeps the half the router cannot serve", () => {
  it("captures only the application, and hands back the rest", () => {
    const route = routeDirect("Open Notepad and write a 200-word essay about fast cars");
    expect(route?.calls).toEqual([{ name: "app_open", arguments: { name: "Notepad" } }]);
    expect(route?.remainder).toBe("write a 200-word essay about fast cars");
  });

  it.each([
    ["open notepad and type hello", "notepad", "type hello"],
    ["open chrome, then search for flights", "chrome", "search for flights"],
    ["launch spotify and play something", "spotify", "play something"],
  ])("splits %j", (request, app, rest) => {
    const route = routeDirect(request);
    expect(route?.calls[0]?.arguments).toEqual({ name: app });
    expect(route?.remainder).toBe(rest);
  });

  it("leaves a simple open with nothing left over", () => {
    const route = routeDirect("open notepad");
    expect(route?.calls[0]?.arguments).toEqual({ name: "notepad" });
    expect(route?.remainder).toBeUndefined();
  });

  it("opens an application nobody hardcoded", () => {
    /*
     * The old rule fired only for names in a fifteen-entry list, so OCADE
     * could not open Blender, Slack, or anything a user actually installed —
     * while still mis-firing on the sentence above, because "notepad" appeared
     * inside it. Shape, not membership, is what separates a name from a
     * sentence.
     */
    expect(routeDirect("open Blender")?.calls[0]?.arguments).toEqual({ name: "Blender" });
    expect(routeDirect("open Fictional Ledger Pro")?.calls[0]?.arguments).toEqual({
      name: "Fictional Ledger Pro",
    });
  });

  it.each(["open the report I wrote yesterday", "open it", "open that file", "open my email"])(
    "still sends %j to the model",
    (request) => {
      // An instruction that begins with "open" is not an application name.
      expect(routeDirect(request)).toBeNull();
    },
  );
});

describe("one router, so the volume rules live here too", () => {
  it.each([
    ["set volume to 40", { action: "set", level: 40 }],
    ["mute", { action: "mute" }],
    ["unmute", { action: "unmute" }],
    ["turn the volume up", { action: "step", by: 10 }],
    ["quieter", { action: "step", by: -10 }],
  ])("routes %j deterministically", (request, args) => {
    expect(routeDirect(request)?.calls[0]).toEqual({ name: "system_volume", arguments: args });
  });

  it("refuses an impossible level rather than clamping it", () => {
    expect(routeDirect("set volume to 400")).toBeNull();
  });
});

/*
 * THE UNCONTRACTED FORM, WHICH IS THE ONE PEOPLE ACTUALLY TYPE.
 *
 * Found by driving the real Control + Work panel rather than by reading the
 * regex: "what is on my screen" matched nothing here, fell through the entire
 * router, and went to the model. The right tool ran about eleven seconds
 * later. Nothing errored, so from the outside it read as PC control hanging.
 *
 * The old pattern was `what'?s`, which covers "what's" and "whats" and misses
 * "what is" — the plainest spelling of the sentence. These cases exist so the
 * contraction and the full form can never drift apart again.
 */
describe("observation rules accept 'what is' as well as \u201cwhat's\u201d", () => {
  it.each([
    ["what is on my screen", "screen_observe"],
    ["what's on my screen", "screen_observe"],
    ["whats on the screen", "screen_observe"],
    ["what can you see", "screen_observe"],
    ["show me my screen", "screen_observe"],
    ["what is my cpu usage", "system_status"],
    ["what's my battery", "system_status"],
    ["battery level", "system_status"],
    ["what is open", "window_list"],
    ["which programs are open", "window_list"],
  ])("routes %j without a model", (request, tool) => {
    const route = routeDirect(request);
    expect(route?.calls[0]?.name).toBe(tool);
    expect(route?.remainder).toBeUndefined();
  });

  /*
   * The observation rules are checked BEFORE the search rules, so a hardware
   * word inside a search must not be answered by reading this computer. An
   * earlier draft of the battery fix allowed a bare `battery` and did exactly
   * that.
   */
  it.each([
    "search for battery replacement",
    "google cpu usage in linux",
    "look up how much memory chrome needs",
  ])("does not answer %j from local telemetry", (request) => {
    expect(routeDirect(request)?.calls[0]?.name).not.toBe("system_status");
  });
});

/*
 * THREE DEFECTS SEEN IN THE ADDRESS BAR AND THE TASKBAR, NOT IN A LOG.
 *
 *   youtube.com/results?search_query=and+play+the+best+song
 *   youtube.com/results?search_query=and+search+for+english+song
 *   bing.com/search?q=downloads%20folder      <- asked about THIS computer
 *
 * The first two are one bug: every search pattern captures "the rest of the
 * sentence", which on a compound instruction includes the connector and the
 * verb. The third is a different bug with the same shape — a local folder fell
 * through the app resolver into a web search.
 */
describe("a search query is the thing to search for, not the rest of the sentence", () => {
  it.each([
    ["open the song in youtube and play the best song", "the best song"],
    ["open chrome and open youtube and search for english song", "english song"],
    ["search youtube for lofi beats", "lofi beats"],
  ])("cleans %j", (request, query) => {
    expect(routeDirect(request)?.calls[0]).toEqual({
      name: "youtube_search",
      arguments: { query },
    });
  });

  it("cleans web searches with the same rule, not a separate one", () => {
    expect(routeDirect("search the web for battery replacement")?.calls[0]).toEqual({
      name: "parallel_search",
      arguments: { query: "battery replacement" },
    });
  });

  it("does not eat a word that merely starts with a connector", () => {
    // Without a word boundary, "android" loses its "and" and becomes "roid".
    expect(routeDirect("search for android tutorials")?.calls[0]?.arguments).toEqual({
      query: "android tutorials",
    });
  });

  it("falls through when stripping leaves nothing real", () => {
    // "and play it" reduces to "it", which is not a search — the model may
    // know what "it" was, and a pronoun query certainly does not.
    expect(routeDirect("slect a love song from youtube and play it")).toBeNull();
  });
});

describe("a local folder is opened, never searched for", () => {
  it.each([
    ["open downloads", "Downloads"],
    ["open downloads folder", "Downloads"],
    ["show desktop", "Desktop"],
    ["open pictures folder", "My Pictures"],
    ["open this pc", "MyComputerFolder"],
  ])("routes %j to Explorer", (request, folder) => {
    expect(routeDirect(request)?.calls[0]).toEqual({
      name: "folder_open",
      arguments: { folder },
    });
  });

  it("opens the subfolder itself rather than handing it to the model", () => {
    /*
     * THIS USED TO RETURN A REMAINDER, AND THAT WAS THE BUG.
     *
     * "…and open the folder named mummy" went to the model, which cannot click
     * a row in a list it cannot see — so Explorer opened and nothing else
     * happened. Both halves are deterministic, so both are emitted as calls
     * and the model is not involved at all.
     */
    const route = routeDirect("open downloads folder and open the folder named mummy");
    expect(route?.rule).toBe("folder.open.item");
    expect(route?.calls).toEqual([
      { name: "folder_open", arguments: { folder: "Downloads" } },
      { name: "folder_item_open", arguments: { item: "mummy" } },
    ]);
    expect(route?.remainder).toBeUndefined();
  });

  it("still treats a real application as an application", () => {
    // The folder rule runs FIRST, so this is the case that proves it did not
    // swallow every "open X". WhatsApp is deliberately NOT the example any
    // more — it has its own skill now, because driving it through app_open
    // fails at every step.
    expect(routeDirect("open notepad")?.calls[0]).toEqual({
      name: "app_open",
      arguments: { name: "notepad" },
    });
    expect(routeDirect("open chrome")?.calls[0]?.name).toBe("app_open");
  });
});

describe("opening a chat app does not go looking for anybody", () => {
  it("opens WhatsApp and nothing else", () => {
    // `whatsapp_open`, not `app_open`: WhatsApp is a packaged app with no
    // .exe, so the generic launcher cannot start it at all.
    const route = routeDirect("open whatsapp");
    expect(route?.calls).toEqual([{ name: "whatsapp_open", arguments: {} }]);
    // No contact lookup is implied by opening an app. A contact is only
    // searched for when the user names one.
    expect(route?.calls.some((c) => c.name === "whatsapp_find_contact")).toBe(false);
    expect(route?.remainder).toBeUndefined();
  });

  it("stops the contact name at the clause, and writes the rest", () => {
    /*
     * THE SEARCH THAT LOOKED FOR A WHOLE SENTENCE.
     *
     * "open whatsapp and search for Meta ai and ask a question about anything
     * computer related" put EVERY ONE OF THOSE WORDS in the search box, and
     * WhatsApp answered honestly: "No chats, contacts or messages found." The
     * pattern captured "everything after `search for`", which on a compound
     * instruction is the rest of the instruction.
     *
     * A contact name ends at the clause boundary. What follows is a brief for
     * the message, so it goes down the compose path -- the model writes the
     * words, the skill types them -- rather than back to the model as a loose
     * instruction, which is what produced narration instead of typing.
     */
    const route = routeDirect(
      "open whatsapp and search for Meta ai and ask a question about anything computer related",
    );
    expect(route?.rule).toBe("whatsapp.find");
    expect(route?.calls).toEqual([
      { name: "whatsapp_open", arguments: {} },
      { name: "whatsapp_find_contact", arguments: { contact: "Meta ai" } },
    ]);
    expect(route?.compose).toEqual({
      brief: "ask a question about anything computer related",
      app: "whatsapp",
    });
    // The leftover is a writing brief, not a second command for the model.
    expect(route?.remainder).toBeUndefined();
  });

  it("finds the payload after the LAST messaging verb, however often it is restated", () => {
    /*
     * FIFTY-EIGHT CHARACTERS OF INSTRUCTION, TYPED INTO A REAL CHAT.
     *
     * "open whatsapp and search meta ai and find the contact named meta ai and
     * send meta ai hi message" put this into the Meta AI conversation:
     *
     *     find the contact named meta ai and send meta ai hi message
     *
     * The parser peeled verbs off the FRONT of the leftover, and this leftover
     * began with "find" -- not a messaging verb -- so nothing was peeled and
     * the whole sentence became the words to send.
     *
     * People restate themselves. Every clause before the final messaging verb
     * is another way of saying "get me to that chat", which has already
     * happened. The words are whatever follows the last one.
     */
    const route = routeDirect(
      "open whatsapp and search meta ai and find the contact named meta ai and send meta ai hi message",
    );
    expect(route?.calls?.[1]?.arguments).toEqual({ contact: "meta ai" });
    expect(route?.calls?.[2]).toEqual({ name: "whatsapp_type", arguments: { message: "hi" } });
  });

  it("does not mistake the trailing noun for the verb", () => {
    // "message" ends that sentence AND is a messaging verb. Searching for the
    // last verb before removing the noun found the final word, leaving an
    // empty payload -- safe, but still wrong: the words wanted were "hi".
    const route = routeDirect("whatsapp find H and send H hi message");
    expect(route?.calls?.[2]?.arguments).toEqual({ message: "hi" });
  });

  it("drops the grammar between naming a message and quoting it", () => {
    const route = routeDirect("open whatsapp find H and send H a message saying good morning");
    expect(route?.calls?.[2]?.arguments).toEqual({ message: "good morning" });
  });

  it("REFUSES to type a leftover it did not understand", () => {
    /*
     * THE SAFETY PROPERTY, AND THE REASON THIS FILE EXISTS.
     *
     * A message cannot be unsent. When the parser cannot tell what was meant to
     * be SAID, the honest answer is to type nothing and let the model look at
     * the screen -- because between guessing and declining, only declining can
     * be corrected afterwards.
     */
    const route = routeDirect("open whatsapp and find H and then open chrome and search for cats");
    const typed = route?.calls?.find((c) => c.name === "whatsapp_type");
    expect(typed, "an instruction must never be typed into somebody's chat").toBeUndefined();
    // It is handed on rather than dropped: the chat is open, the rest is the
    // model's problem.
    expect(route?.remainder ?? route?.compose).toBeTruthy();
  });

  it("types the words the user gave, and only composes when asked for a job", () => {
    /*
     * THE PAYLOAD THAT ARRIVED WITH ITS ENVELOPE STILL ATTACHED.
     *
     * "open whatsapp and search for H and message H hi" reached the composer
     * as the brief "message H hi", so OCADE was asked to write something
     * ABOUT that phrase instead of typing "hi". The verb and the recipient
     * are addressing, not content.
     *
     * And once they are off, most of these need no model at all: the user
     * supplied the exact words, so they are typed verbatim. A model can only
     * paraphrase what is already decided.
     */
    const literal: [string, string][] = [
      ["open whatsapp and search for H and message H hi", "hi"],
      ["open whatsapp and find H and say hello", "hello"],
      ["whatsapp message H, tell him the build is done", "the build is done"],
    ];
    for (const [said, expected] of literal) {
      const route = routeDirect(said);
      expect(route?.rule, said).toBe("whatsapp.find");
      expect(route?.calls?.[1], said).toEqual({
        name: "whatsapp_find_contact",
        arguments: { contact: "H" },
      });
      // Typed deterministically, as a third call -- no compose, no model.
      expect(route?.calls?.[2], said).toEqual({
        name: "whatsapp_type",
        arguments: { message: expected },
      });
      expect(route?.compose, said).toBeUndefined();
    }

    // A JOB, not a quotation. "ask ..." describes what to write rather than
    // supplying it, so this one does go to the model.
    const job = routeDirect(
      "open whatsapp and search for Meta ai and ask a question about computers",
    );
    expect(job?.compose?.app).toBe("whatsapp");
    expect(job?.compose?.brief).toBe("ask a question about computers");
    expect(job?.calls?.some((c) => c.name === "whatsapp_type")).toBe(false);
  });

  it("opens the chat too when the user named one", () => {
    /*
     * THE INSTRUCTION THAT HUNG, ASKED THREE TIMES AND NEVER ONCE SERVED.
     *
     * "open whatsapp and search he person named H" was split into
     * `app_open(whatsapp)` plus a remainder handed to a 3B model, which
     * narrated instead of searching. Both halves are deterministic, so both
     * are emitted as calls and no model is involved. The misspelling is in
     * the test because it is what actually gets typed.
     */
    for (const said of [
      "open whatsap and search he person named H",
      "open whatsapp and search the person named H",
      "whatsapp find H",
    ]) {
      const route = routeDirect(said);
      expect(route?.rule, said).toBe("whatsapp.find");
      expect(route?.calls, said).toEqual([
        { name: "whatsapp_open", arguments: {} },
        { name: "whatsapp_find_contact", arguments: { contact: "H" } },
      ]);
      expect(route?.remainder, said).toBeUndefined();
    }
  });
});

/*
 * "PLAY" AND "SEARCH" ARE DIFFERENT REQUESTS.
 *
 * Asked three ways in one session — "play a english song in youtube",
 * "slect a love song from youtube and play it", "open the song in youtube and
 * play the best song" — OCADE opened a results page every time and stopped.
 * A results page is not a song.
 */
describe("play means play, not search", () => {
  it.each([
    ["play a english song in youtube", "english song"],
    ["on youtube play lofi beats", "lofi beats"],
    ["put on some jazz on youtube", "some jazz"],
    ["listen to bohemian rhapsody on youtube", "bohemian rhapsody"],
  ])("routes %j to youtube_play", (request, query) => {
    expect(routeDirect(request)?.calls[0]).toEqual({
      name: "youtube_play",
      arguments: { query },
    });
  });

  it('accepts "in youtube" as well as "on youtube"', () => {
    // Only "on" was matched before, so "play X IN youtube" — which is how the
    // user actually phrased it — missed the router entirely.
    expect(routeDirect("play english song in youtube")?.rule).toBe("web.youtube.play");
    expect(routeDirect("play english song on youtube")?.rule).toBe("web.youtube.play");
  });

  it("still searches when the user asked to search", () => {
    expect(routeDirect("search youtube for english song")?.calls[0]).toEqual({
      name: "youtube_search",
      arguments: { query: "english song" },
    });
  });
});
