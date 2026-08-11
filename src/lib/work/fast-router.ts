/**
 * The fast path: what OCADE can decide without asking a language model.
 *
 * WHY THIS EXISTS
 * ---------------
 * "Stop" took eleven seconds. Not because stopping is slow — stopping is a
 * function call — but because the sentence went to a 7B model first so it could
 * decide what "stop" meant. Every deterministic instruction paid the same toll:
 * open Notepad, list my windows, scroll down, what's on my screen. The model was
 * being asked to translate English into a vocabulary that a regular expression
 * can translate correctly, every time, in under a millisecond.
 *
 * So the router runs first. When a request is UNAMBIGUOUS it becomes a tool call
 * directly. When it is not, it goes to the model, which is what a model is for.
 *
 * THE BAR FOR BEING HERE IS "CANNOT REASONABLY MEAN ANYTHING ELSE"
 * -----------------------------------------------------------------
 * Not "usually means". A rule that fires on 95% of phrasings is a rule that
 * silently does the wrong thing on the other 5%, and the wrong thing here moves
 * somebody's mouse. Every pattern below either extracts a complete, validated
 * argument set or returns null and lets the model think. There is no branch that
 * guesses at a missing argument.
 *
 * THE EMPTY-ARGUMENT RULE, WHICH IS THE WHOLE REASON FOR `requireText`
 * ---------------------------------------------------------------------
 * A live run produced a YouTube navigation with `search_query=` — empty. The
 * pattern had matched "search YouTube for" and captured nothing after it, and
 * nothing downstream objected, so OCADE opened a blank results page and reported
 * success. Every extraction here goes through `requireText`, and a rule whose
 * argument comes back empty DOES NOT FIRE. Falling through to the model is
 * always better than acting on a blank.
 */

import type { ToolCall } from "@/lib/agent/loop";

export type DirectControl = "stop" | "pause" | "continue";

export interface DirectRoute {
  /** A loop-level control rather than a tool. */
  control?: DirectControl;
  /** One or more tool calls to run in order. Empty when `control` is set. */
  calls: ToolCall[];
  /** What OCADE says it is doing. Shown before the first action runs. */
  say: string;
  /** Which rule fired, for latency reporting and for debugging a surprise. */
  rule: string;
}

/**
 * Trim, collapse whitespace, and reject anything that is not real text.
 *
 * Returns null rather than "" so a caller cannot accidentally treat an absent
 * argument as an empty one — the exact mistake that produced the blank YouTube
 * search. Also rejects a capture that is only punctuation or a stray quote,
 * which is what "search youtube for ." leaves behind.
 */
export function requireText(value: string | undefined | null): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^["'`«»]+|["'`«».,!?]+$/g, "")
    .trim();
  if (cleaned.length === 0) return null;
  if (!/[\p{L}\p{N}]/u.test(cleaned)) return null;
  return cleaned;
}

/**
 * Words that cannot be a search on their own.
 *
 * FOUND BY THE TESTS FOR THIS FILE, WHICH IS THE POINT OF HAVING THEM.
 * "search the web for" extracts cleanly to "for", and "search youtube for"
 * extracts to "for": each pattern's optional `(?:for\s+)?` group needs a
 * trailing space, so with nothing after it the preposition itself becomes the
 * query. `requireText` was satisfied — "for" is real text — and OCADE would
 * have searched YouTube for the word "for".
 *
 * That is the same failure as the blank query wearing a disguise, so it is
 * caught in the same place.
 */
const NOT_A_QUERY = new Set([
  "for",
  "the",
  "a",
  "an",
  "it",
  "this",
  "that",
  "them",
  "me",
  "up",
  "on",
  "in",
  "to",
  "about",
  "some",
  "something",
  "anything",
  "stuff",
  "and",
  "or",
  "please",
  "web",
  "internet",
  "online",
  "youtube",
  "google",
]);

/** A search term that is worth sending, or null. */
export function meaningfulQuery(value: string | undefined | null): string | null {
  const text = requireText(value);
  if (!text) return null;
  const words = text.toLowerCase().split(/\s+/);
  if (words.every((word) => NOT_A_QUERY.has(word))) return null;
  return text;
}

/** Strip the polite scaffolding people put round an instruction. */
function core(request: string): string {
  return request
    .trim()
    .replace(
      /^(please|hey|ok(ay)?|now|could you|can you|would you|i want you to|i'?d like you to)\b[\s,]*/gi,
      "",
    )
    .replace(/\bfor me\b|\bplease\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Applications OCADE will name in a direct route. Anything else asks the model. */
const APP_WORDS =
  /\b(notepad|calculator|calc|chrome|edge|firefox|explorer|file explorer|cursor|vs ?code|visual studio code|word|excel|powerpoint|outlook|spotify|terminal|command prompt|paint|settings|task manager)\b/i;

/** A tidy application name from a loose phrase. */
function appName(raw: string | undefined): string | null {
  const text = requireText(raw);
  if (!text) return null;
  const cleaned = text
    .replace(/\b(the|app|application|program|window|please)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return requireText(cleaned);
}

const URL_LIKE = /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)\b/i;

function asUrl(raw: string | undefined): string | null {
  const text = requireText(raw);
  if (!text) return null;
  const match = URL_LIKE.exec(text);
  if (!match) return null;
  const found = match[1];
  return /^https?:\/\//i.test(found) ? found : `https://${found}`;
}

/**
 * Route a request without a model, or return null.
 *
 * Pure and synchronous. Every rule is one regular expression, one extraction and
 * one validation, so the whole pass costs microseconds and can be reasoned about
 * by reading it top to bottom.
 */
export function routeDirect(request: string): DirectRoute | null {
  const text = core(request);
  if (!text) return null;
  const lower = text.toLowerCase();

  /* ------------------------------------------------------------ control -- */
  // Checked first and matched tightly. These have to be instant, and they must
  // never be swallowed by a later rule that happens to contain the same verb.
  if (/^(stop|halt|cancel|abort|stop it|stop now|that'?s enough|quit)\b\.?$/i.test(lower)) {
    return { control: "stop", calls: [], say: "Stopping.", rule: "control.stop" };
  }
  if (/^(pause|hold on|wait|hang on|freeze)\b\.?$/i.test(lower)) {
    return { control: "pause", calls: [], say: "Paused.", rule: "control.pause" };
  }
  if (/^(continue|resume|carry on|go on|keep going|proceed)\b\.?$/i.test(lower)) {
    return { control: "continue", calls: [], say: "Carrying on.", rule: "control.continue" };
  }

  /* -------------------------------------------------------- observation -- */
  if (
    /\b(what'?s on (my|the) screen|what do you see|what can you see|read (my|the) screen|look at (my|the) screen|describe (my|the) screen)\b/i.test(
      lower,
    )
  ) {
    return {
      calls: [{ name: "screen_observe", arguments: {} }],
      say: "Looking at your screen.",
      rule: "observe.screen",
    };
  }
  if (
    /\b(what|which) (windows|apps|applications) (are |do i have )?open\b|\blist (my |the )?(open )?windows\b/i.test(
      lower,
    )
  ) {
    return {
      calls: [{ name: "window_list", arguments: {} }],
      say: "Reading your open windows.",
      rule: "observe.windows",
    };
  }
  if (
    /\b(system status|how is my (pc|computer) doing|cpu usage|memory usage|how much (ram|memory)|battery level|why is my (pc|computer) slow)\b/i.test(
      lower,
    )
  ) {
    return {
      calls: [{ name: "system_status", arguments: {} }],
      say: "Reading this computer's state.",
      rule: "observe.system",
    };
  }
  if (
    /\b(what|how many) (screens|displays|monitors)\b|\blist (my |the )?(screens|displays|monitors)\b/i.test(
      lower,
    )
  ) {
    return {
      calls: [{ name: "display_list", arguments: {} }],
      say: "Checking your screens.",
      rule: "observe.displays",
    };
  }
  if (/\bwhat (applications|apps|programs) (are |do i have )?installed\b/i.test(lower)) {
    return {
      calls: [{ name: "app_list_installed", arguments: {} }],
      say: "Checking what is installed.",
      rule: "observe.installed",
    };
  }

  /* --------------------------------------------------------------- web --
   * BEFORE the application rules, because "open youtube and search for X" and
   * "open chrome" both begin with "open" and only one of them is an app launch.
   */
  const youtube =
    /\b(?:search (?:on |in )?youtube for|youtube search for|(?:find|search for|look for|play|put on)\s+(.+?)\s+on youtube|on youtube[, ]+(?:search for|find|play)|youtube)\b/i;
  if (/\byoutube\b/i.test(lower)) {
    const patterns = [
      /\b(?:search (?:on |in )?youtube for|youtube search for|search youtube for)\s+(.+)$/i,
      /\b(?:play|put on|find|search for|look for)\s+(.+?)\s+on youtube\b/i,
      /\bon youtube[,: ]+(?:search for|find|play|look for)\s+(.+)$/i,
      /\byoutube\s+(?:for\s+)?(.+)$/i,
    ];
    for (const pattern of patterns) {
      const query = meaningfulQuery(pattern.exec(text)?.[1]);
      if (query) {
        return {
          calls: [{ name: "youtube_search", arguments: { query } }],
          say: `Searching YouTube for “${query}”.`,
          rule: "web.youtube.search",
        };
      }
    }
    /*
     * "Open YouTube" with nothing to search for is a real instruction and a
     * complete one — it means open the site. What it must NEVER become is a
     * search with an empty query, which is precisely the bug this rule set was
     * written to kill.
     */
    if (/\b(open|go to|launch)\b/i.test(lower)) {
      return {
        calls: [{ name: "browser_navigate", arguments: { url: "https://www.youtube.com" } }],
        say: "Opening YouTube.",
        rule: "web.youtube.open",
      };
    }
    return null;
  }
  void youtube;

  const searchPatterns = [
    /^(?:search|google|look up|find out|find)\s+(?:the (?:web|internet)\s+)?(?:for\s+)?(.+)$/i,
    /\bsearch (?:the )?(?:web|internet|online) for\s+(.+)$/i,
    /\bwhat is (the )?(.+)$/i,
  ];
  if (/\b(search|google|look up)\b/i.test(lower)) {
    for (const pattern of searchPatterns) {
      const query = meaningfulQuery(pattern.exec(text)?.[1]);
      if (query) {
        return {
          calls: [{ name: "web_search", arguments: { query } }],
          say: `Searching the web for “${query}”.`,
          rule: "web.search",
        };
      }
    }
    // "search" with nothing after it. The model may know from context; a blank
    // query certainly does not.
    return null;
  }

  if (/\b(open|go to|navigate to|visit|browse to)\b/i.test(lower)) {
    const url = asUrl(text);
    if (url) {
      return {
        calls: [{ name: "browser_navigate", arguments: { url } }],
        say: `Opening ${url}.`,
        rule: "web.navigate",
      };
    }
  }

  if (/\b(scroll (down|up)|page (down|up))\b/i.test(lower)) {
    const direction = /\b(up)\b/i.test(lower) ? "up" : "down";
    return {
      calls: [{ name: "browser_scroll", arguments: { direction } }],
      say: `Scrolling ${direction}.`,
      rule: "web.scroll",
    };
  }
  if (/\b(what|which) tabs\b|\blist (my |the )?tabs\b|\bshow (my |the )?tabs\b/i.test(lower)) {
    return {
      calls: [{ name: "browser_tabs", arguments: {} }],
      say: "Reading your open tabs.",
      rule: "web.tabs",
    };
  }
  const media =
    /\b(pause|play|resume|stop|mute|unmute)\b.{0,20}\b(video|music|song|audio|it|playback|media)\b/i.exec(
      lower,
    );
  if (media) {
    const verb = media[1].toLowerCase();
    const action = verb === "resume" ? "play" : verb === "stop" ? "pause" : verb;
    if (["play", "pause", "mute", "unmute"].includes(action)) {
      return {
        calls: [{ name: "browser_media", arguments: { action } }],
        say: `${action[0].toUpperCase()}${action.slice(1)}ing the media.`,
        rule: "web.media",
      };
    }
  }

  /* ------------------------------------------------------- applications -- */
  const focus =
    /\b(?:switch to|focus|bring (?:up )?|go to)\s+(.+?)(?:\s+(?:app|application|window))?$/i.exec(
      text,
    );
  if (focus && APP_WORDS.test(focus[1])) {
    const name = appName(focus[1]);
    if (name) {
      return {
        calls: [{ name: "app_focus", arguments: { name } }],
        say: `Switching to ${name}.`,
        rule: "app.focus",
      };
    }
  }

  const open = /\b(?:open|launch|start|run)\s+(.+?)(?:\s+(?:app|application|program))?$/i.exec(
    text,
  );
  if (open) {
    const candidate = open[1];
    // Only names OCADE recognises as applications. "open the report I wrote"
    // is a real instruction and not one a regular expression should act on.
    if (APP_WORDS.test(candidate)) {
      const name = appName(candidate);
      if (name) {
        return {
          calls: [{ name: "app_open", arguments: { name } }],
          say: `Opening ${name}.`,
          rule: "app.open",
        };
      }
    }
  }

  /* ----------------------------------------------------------- windows -- */
  const arrange = /\b(maximi[sz]e|full ?screen|left half|right half|centre|center)\b/i.exec(lower);
  if (arrange && /\bwindow\b/i.test(lower)) {
    const word = arrange[1].toLowerCase();
    const layout = word.startsWith("left")
      ? "left"
      : word.startsWith("right")
        ? "right"
        : word.startsWith("cent")
          ? "centre"
          : "maximise";
    return {
      calls: [{ name: "window_arrange", arguments: { layout } }],
      say: `Moving the window.`,
      rule: "window.arrange",
    };
  }

  /* ------------------------------------------------------- keyboard -- */
  // Named keys only, and only when the sentence is about pressing one. "press
  // enter" is unambiguous; "press the blue button" is not, and falls through.
  const key =
    /^press (?:the )?(enter|return|escape|esc|tab|space|backspace|delete|page ?down|page ?up|home|end|f\d{1,2})\b/i.exec(
      text,
    );
  if (key) {
    const named = key[1].toLowerCase().replace(/\s+/g, "").replace("return", "enter");
    return {
      calls: [{ name: "press_key", arguments: { key: named } }],
      say: `Pressing ${named}.`,
      rule: "input.key",
    };
  }

  /* ------------------------------------------------------------- files -- */
  if (
    /\bwhat (files|notes) (are |do you have )?(in your folder|saved)\b|\blist your files\b/i.test(
      lower,
    )
  ) {
    return {
      calls: [{ name: "workspace_list", arguments: {} }],
      say: "Looking in my folder.",
      rule: "files.list",
    };
  }

  return null;
}

/**
 * Whether a request is a pure control word.
 *
 * Separate from `routeDirect` because the caller needs this BEFORE it decides
 * whether a message is a new task or a mid-task revision: "stop" typed while
 * OCADE is working is not a change of plan, it is a stop.
 */
export function directControl(request: string): DirectControl | null {
  const route = routeDirect(request);
  return route?.control ?? null;
}
