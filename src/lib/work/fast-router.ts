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
  /**
   * The part of the instruction this pass could NOT serve.
   *
   * Set when a request contains a fast action AND something more — "open
   * Notepad and write an essay". The caller runs `calls`, then sends this to
   * the model as the remaining work. Absent when the router handled the whole
   * request, which is the ordinary case.
   */
  remainder?: string;
  /**
   * Text that has to be WRITTEN before it can be typed.
   *
   * "type about cars in 100 words" is two jobs wearing one sentence: compose
   * the words, then put them in a window. The router can do the second half
   * deterministically and cannot do the first at all, so it hands the writing
   * brief back and the caller composes it with a plain completion.
   */
  compose?: {
    /** What to write, in the user's own words. */
    brief: string;
    /** Where it goes. Absent means whatever is in front. */
    app?: string;
  };
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

/**
 * Strip the sentence scaffolding off an extracted search query.
 *
 * THE BUG THIS FIXES, SEEN IN THE ADDRESS BAR.
 * ---------------------------------------------
 *     "open the song in youtube and play the best song"
 *        -> youtube.com/results?search_query=and+play+the+best+song
 *     "open chrome and open youtube and search for english song"
 *        -> youtube.com/results?search_query=and+search+for+english+song
 *
 * Every pattern here captures "everything after the keyword", which on a
 * compound sentence is the rest of the instruction rather than the thing to
 * search for. The connector and the verb ride along into the query, and
 * YouTube dutifully searches for them.
 *
 * Peeled from BOTH ENDS and repeatedly, because real sentences stack them:
 * "and play the best song" is a connector, then a verb, then the query. Done
 * once, "and" would come off and "play" would stay.
 *
 * This is deliberately a shared function rather than a tweak to one regex —
 * the same leakage was live on the YouTube rules and the web-search rules, and
 * the next rule someone adds inherits the cleaning instead of the bug.
 */
const QUERY_LEAD =
  /^(?:and|then|also|so|now|please|ok(?:ay)?|to|for|of|it|go|open|launch|start|play|put on|watch|listen to|stream|search(?: for)?|find|look(?: for| up)?|show me|get me|give me|the song|a song|some song|the video|a video|video of|song of|a)\b[\s,:-]*/i;

const QUERY_TAIL =
  /[\s,:-]*\b(?:please|thanks|thank you|for me|on youtube|in youtube|on the internet|on the web|online)\b\.?$/i;

/** Remove leading connectors/verbs and trailing site names, repeatedly. */
export function cleanQuery(raw: string | undefined | null): string | null {
  let text = requireText(raw);
  if (!text) return null;
  for (let pass = 0; pass < 8; pass += 1) {
    const before: string = text;
    text = text.replace(QUERY_LEAD, "").replace(QUERY_TAIL, "").trim();
    if (text === before) break;
    if (!text) return null;
  }
  /*
   * `meaningfulQuery` has the final say. Stripping can legitimately consume the
   * whole string — "and play it" reduces to "it" — and a query that is only
   * filler must fall through to the model rather than search for a pronoun.
   */
  return meaningfulQuery(text);
}

/**
 * Local folders, which are not applications and must never become a web search.
 *
 * THE BUG, SEEN LIVE: "open downloads folder and open the folder named mummy"
 * launched Bing and searched for "downloads folder". `app_open` looked for an
 * installed program called that, found none, and the fallback path went to the
 * web — so a request about this computer was answered by the internet.
 *
 * A shell folder has a canonical name Windows itself resolves, so this is a
 * lookup rather than a guess. Listed once, here, and shared: the same names
 * would otherwise have to be repeated in the app resolver, and the two copies
 * would disagree the first time somebody added one.
 */
const SHELL_FOLDERS: Record<string, string> = {
  downloads: "Downloads",
  download: "Downloads",
  documents: "Personal",
  document: "Personal",
  desktop: "Desktop",
  pictures: "My Pictures",
  photos: "My Pictures",
  videos: "My Video",
  movies: "My Video",
  music: "My Music",
  "recycle bin": "RecycleBinFolder",
  "this pc": "MyComputerFolder",
  "my computer": "MyComputerFolder",
  computer: "MyComputerFolder",
  "c drive": "MyComputerFolder",
  home: "UsersFilesFolder",
  "user folder": "UsersFilesFolder",
  "home folder": "UsersFilesFolder",
};

/** The shell folder a phrase names, ignoring "folder"/"my" noise. */
export function shellFolderFor(raw: string | undefined | null): string | null {
  const text = requireText(raw);
  if (!text) return null;
  const key = text
    .toLowerCase()
    .replace(/^(?:my|the)\s+/, "")
    .replace(/\sfolder\b.*$/, "")
    .replace(/\sdirectory\b.*$/, "")
    .trim();
  return Object.prototype.hasOwnProperty.call(SHELL_FOLDERS, key) ? SHELL_FOLDERS[key] : null;
}

/**
 * Peel the scaffolding off a named contact.
 *
 * "open whatsapp and search HE PERSON NAMED H" — the typo is real, taken from
 * a live run, and it is why this is a loop rather than one optional group in
 * the pattern. `(?:the\s+)?` does not match "he ", so the contact came out as
 * "he person named H" and WhatsApp was searched for that whole phrase.
 *
 * Stripping repeatedly from the front handles any order and any subset of the
 * filler words, and survives the next misspelling without a new branch.
 */
const CONTACT_NOISE =
  /^(?:the|he|a|an|for|to|of|my|person|contact|group|chat|named|called|nemed|calld)\b[\s,]*/i;

export function contactName(raw: string | undefined | null): string | null {
  let text = requireText(raw);
  if (!text) return null;
  for (let pass = 0; pass < 8; pass += 1) {
    const before: string = text;
    text = text.replace(CONTACT_NOISE, "").trim();
    if (text === before) break;
    if (!text) return null;
  }
  return requireText(text);
}

/**
 * Split a message clause into "who it is for" and "what to say".
 *
 * THE BUG, FROM A LIVE RUN, VISIBLE IN THE TIMELINE.
 * ---------------------------------------------------
 * "open whatsapp and search for H and message H hi" reached the composer as
 * the brief "message H hi" — the command verb and the recipient's name were
 * still attached to the payload, so OCADE was asked to WRITE SOMETHING ABOUT
 * the phrase "message H hi" rather than to type "hi".
 *
 * The instruction already contains the exact words. "message H hi" is not a
 * brief; it is a quotation. So the verb comes off, the target comes off, and
 * what remains is typed VERBATIM — no model involved, which also makes it
 * instant and impossible to paraphrase.
 *
 * LITERAL AND BRIEF ARE DIFFERENT THINGS AND THE DIFFERENCE IS THE LEADING
 * VERB. "message H hi" gives the words. "ask a question about computers" gives
 * a job. Typing the second one verbatim would send the sentence "ask a
 * question about computers" to somebody, which is exactly as wrong as
 * paraphrasing the first.
 */
const MESSAGE_VERB =
  /^(?:message|msg|send|text|tell|write to|say to|speak to|type|write|say)\b[\s,:-]*/i;

/**
 * A pronoun standing in for the recipient, which is also not the message.
 *
 * "tell him the build is done" lost "tell" and kept "him", so the typed text
 * began with a word addressed to nobody. The recipient can be named or it can
 * be a pronoun; either way it is the envelope, not the letter.
 */
const MESSAGE_OBJECT = /^(?:to\s+)?(?:him|her|them|it|everyone|the group)\b[\s,:-]*/i;

/** Verbs that describe a job rather than supply the words. */
const COMPOSE_VERB =
  /^(?:ask|write|compose|summari[sz]e|explain|describe|draft|tell (?:him|her|them) about|make up|think of|come up with|generate)\b/i;

export interface MessageClause {
  /** Words to type exactly as given. */
  literal?: string;
  /** A job for the model: write something matching this. */
  brief?: string;
  /**
   * Left over, and NOT understood as a message.
   *
   * The router will not type this. It goes to the model with the screen, which
   * is the honest answer to "I could not tell what you wanted said".
   */
  unclear?: string;
}

/**
 * Words that mean "operate the computer", not "say this to somebody".
 *
 * A payload containing these is not a message; it is the instruction that was
 * supposed to produce one. See `messageClause` for why that distinction is a
 * safety property rather than a nicety.
 */
const INSTRUCTION_WORDS =
  /\b(?:open|launch|search|find|look\s+for|navigate|click|scroll|contact named|the contact|whats+app?|browser|chrome)\b/i;

/**
 * The noun people put AFTER the words they want sent.
 *
 * "send meta ai hi message" — the last word is a description of the thing, not
 * part of it. Sending "hi message" is not badly wrong, but it is wrong, and it
 * is wrong in a way the person reading the chat can see.
 */
const TRAILING_NOUN = /[\s,]*\b(?:as\s+(?:a|the)\s+)?(?:message|msg|text|note)\b[.!]?$/i;

/**
 * The hinge between naming a message and quoting it.
 *
 * "send H a message saying good morning" — everything up to and including
 * "saying" is grammar. The words start after it. Without this the payload
 * began "saying good morning", which is not what anybody wants delivered.
 */
const QUOTE_HINGE =
  /^(?:(?:a|an|the)\s+)?(?:message|msg|text|note)?\s*(?:saying|that\s+says|which\s+says|reading|:)\b[\s,:-]*/i;

export function messageClause(rest: string | null, who: string | null): MessageClause {
  const text = requireText(rest);
  if (!text) return {};

  /*
   * THE PAYLOAD IS AFTER THE *LAST* MESSAGING VERB, NOT AT THE FRONT.
   *
   * THE LIVE FAILURE. "open whatsapp and search meta ai and find the contact
   * named meta ai and send meta ai hi message" typed FIFTY-EIGHT CHARACTERS
   * into a real person's chat: "find the contact named meta ai and send meta
   * ai hi message". The whole instruction, verbatim, sent to Meta AI.
   *
   * The old version peeled verbs off the FRONT of the leftover. This leftover
   * began with "find", which is not a messaging verb, so nothing was peeled
   * and the entire string was treated as the words to type.
   *
   * People restate themselves — "search X and find the contact named X and
   * send X hi" is one intention said three times. Every clause before the last
   * messaging verb is another way of saying "get me to that chat", which has
   * already happened by the time anything is typed. So the search starts at
   * the END and takes what follows the final send/message/tell.
   */
  /*
   * THE TRAILING NOUN COMES OFF FIRST, AND THE ORDER IS THE WHOLE POINT.
   *
   * "send meta ai hi message" ends with the word "message" — which is also a
   * messaging VERB. Searching for the last verb before removing it found that
   * final word, so the payload became everything after it: nothing at all. The
   * live case produced an empty message and typed nothing, which was safe and
   * still wrong; the words wanted were "hi".
   */
  const withoutNoun = text.replace(TRAILING_NOUN, "").trim() || text;

  const verb = /\b(?:message|msg|send|text|tell|say|write|type)\b/gi;
  let payloadFrom = -1;
  for (let hit = verb.exec(withoutNoun); hit; hit = verb.exec(withoutNoun)) {
    payloadFrom = hit.index + hit[0].length;
  }

  let body = payloadFrom >= 0 ? withoutNoun.slice(payloadFrom) : withoutNoun;

  // Now the addressing, which can follow the verb in any order and any
  // number of times: "send to meta ai", "tell him", "message H,".
  for (let pass = 0; pass < 5; pass += 1) {
    const before: string = body;
    body = body.replace(/^[\s,:-]+/, "");
    body = body.replace(MESSAGE_VERB, "");
    body = body.replace(MESSAGE_OBJECT, "");
    body = body.replace(QUOTE_HINGE, "");
    if (who) {
      const name = who.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      body = body.replace(new RegExp(`^(?:to\\s+)?${name}\\b[\\s,:-]*`, "i"), "");
    }
    body = body.trim();
    if (body === before) break;
  }

  body = body.replace(TRAILING_NOUN, "").trim();

  const cleaned = requireText(body);
  if (!cleaned) return {};

  /*
   * THE GUARD, AND IT IS THE MOST IMPORTANT LINE HERE.
   *
   * If what survived still reads like an instruction, then this function did
   * NOT understand the sentence — and the correct response to not understanding
   * is to type nothing. Typing it anyway is how "find the contact named meta
   * ai and send meta ai hi message" ended up in somebody's chat window.
   *
   * A message cannot be unsent. Between guessing and declining, declining is
   * the only one of the two that can be corrected, so an unparsed leftover goes
   * back as a remainder: the model reads the screen and decides, which is what
   * a person does when a sentence is ambiguous.
   */
  if (INSTRUCTION_WORDS.test(cleaned)) return { unclear: cleaned };

  return COMPOSE_VERB.test(cleaned) ? { brief: cleaned } : { literal: cleaned };
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

/*
 * A CLOSED LIST OF APPLICATIONS WAS THE WRONG SHAPE, TWICE OVER.
 *
 * `APP_WORDS` used to enumerate notepad, chrome, excel and about fifteen
 * others, and the open rule fired only when the phrase contained one of them.
 * That failed in both directions: it could not open Blender, Slack, or anything
 * a user installed that nobody had listed — the exact thing "OCADE controls ANY
 * software" rules out — while still mis-firing on the compound sentence below,
 * because "notepad" appears in "Notepad and write a 200-word essay".
 *
 * What actually separates an application name from an instruction is SHAPE, not
 * membership: a program is a short noun phrase, and an instruction has a verb
 * and a clause. That test is the one below, and it is the same guard the
 * consolidated router uses everywhere it has to tell a name from a sentence.
 */

/** Words that begin a reference this layer cannot resolve. */
const VAGUE_HEAD =
  /^(it|that|this|these|those|them|there|the|a|an|my|your|our|their|his|her|its|some|any|another|up|whatever)$/i;

/** Words that only appear inside a clause — never inside a program's name. */
const CLAUSE_WORD =
  /\b(i|you|we|they|was|were|is|are|am|be|been|just|which|who|whom|whose|that|with|from|about|into|for)\b/i;

/** Where a second instruction starts, when one is glued to the first. */
const CLAUSE_BREAK = /\s+(?:and|then|&|,|so|to|but|plus|after that)\s+|\s*[,;]\s*/i;

/**
 * Split "Notepad and write a 200-word essay" into the app and what is left.
 *
 * THE BUG THIS FIXES, MEASURED LIVE. The old extraction captured to the end of
 * the string, so "Open Notepad and write a 200-word essay about fast cars"
 * produced `app_open({name: "Notepad and write a 200-word essay about fast
 * cars"})`. OCADE tried to launch a program by that name, the model was never
 * consulted, and the essay was never written — while the run reported success.
 *
 * The remainder is RETURNED rather than discarded, because the half this pass
 * cannot serve is still the user's instruction. The caller runs the open and
 * then hands the rest to the model, which is what "open Notepad and write an
 * essay" always meant.
 */
export function splitAppAndRemainder(raw: string | undefined): {
  name: string | null;
  remainder: string | null;
} {
  const text = requireText(raw);
  if (!text) return { name: null, remainder: null };

  const breakAt = text.search(CLAUSE_BREAK);
  const head = breakAt >= 0 ? text.slice(0, breakAt) : text;
  // Connectors can stack — "chrome, then search" separates on both the comma
  // and the "then", and leaving either on the front hands the model a fragment
  // that reads like a sentence continuing from nothing.
  const tail =
    breakAt >= 0
      ? text
          .slice(breakAt)
          .replace(/^(?:\s*[,;]\s*|\s*(?:and|then|&|so|but|plus|after that)\s+)+/i, "")
          .trim()
      : "";

  const cleaned = head
    .replace(/\b(the|app|application|program|window|please)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const name = requireText(cleaned);
  if (!name) return { name: null, remainder: null };

  // An application name is a short noun phrase. Anything else is an
  // instruction that happens to start with "open".
  const words = name.split(/\s+/);
  if (words.length > 4) return { name: null, remainder: null };
  if (VAGUE_HEAD.test(words[0])) return { name: null, remainder: null };
  if (CLAUSE_WORD.test(name)) return { name: null, remainder: null };

  return { name, remainder: tail ? tail : null };
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
 * Sequencing words: this instruction asks for more than one thing.
 *
 * FOUND LIVE, AND IT WAS THE STALL EVERYTHING ELSE GOT BLAMED FOR.
 *
 * "Check how much memory this computer is using, THEN save that number into a
 * file called memory-check.txt" contains the substring "how much memory". The
 * system-status rule below matched it, the router answered the first clause,
 * executed one tool, and ended the mission reporting success. The file was
 * never written and nothing said so.
 *
 * Two model swaps and a classifier fix were made chasing that symptom, because
 * from the outside it looks exactly like a model that gave up after one step.
 * It never reached a model at all — one request in the whole run, and it went
 * straight to the executor.
 *
 * The rule the router has to keep is not "match tightly" but "claim only what
 * you can finish". Every pattern here answers with ONE action; an instruction
 * naming a second one is, by construction, not something this pass can serve,
 * however well its first half matches.
 *
 * Bare "and" is deliberately excluded: "open notepad and type hello" is two
 * steps, but "search for cats and dogs" is one, and no cheap test separates
 * them. The words below cannot mean anything but sequence.
 */
const SEQUENCING =
  /\bthen\b|\bafter (that|which|it)\b|\bfollowed by\b|\band (then|after|also)\b|\bnext,\s|\bonce (that|you)('?ve| have)?\b|;\s*\w/i;

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

  /*
   * A multi-step instruction goes to the model, whatever it looks like.
   *
   * Checked before every rule EXCEPT the control words, which are anchored to
   * the whole string below and so cannot be a clause of something larger —
   * and which must keep working when someone types "stop" at a running task.
   */
  if (SEQUENCING.test(lower) && !/^(stop|halt|cancel|abort|pause|continue|resume)\b/i.test(lower)) {
    /*
     * OPENING IS THE ONE RULE THAT SURVIVES A SEQUENCE, because it is the one
     * that can hand the rest back.
     *
     * "Open Chrome, then search for flights" is two steps, and the blanket bail
     * sent all of it to the model — correct while the router could only answer
     * with a single action, and needlessly slow now that it returns a
     * remainder. The open runs immediately; the search goes to the model.
     *
     * Every other rule still bails, because none of them can split: "search for
     * cats then dogs" has no first half this pass could finish on its own.
     */
    const lead = /^(?:open|launch|start|run)\s+(.+)$/i.exec(text);
    if (lead) {
      const { name, remainder } = splitAppAndRemainder(lead[1]);
      if (name && remainder) {
        return {
          calls: [{ name: "app_open", arguments: { name } }],
          say: `Opening ${name}, then carrying on.`,
          rule: "app.open",
          remainder,
        };
      }
    }
    return null;
  }

  /* ------------------------------------------------------------- audio -- */
  /*
   * Merged from the second fast router (`agent/fast-router.ts`), which is now
   * deleted. Two routers meant two answers: that one refused the compound
   * sentence correctly while this one swallowed it, and only this one was
   * wired to Control + Work — so the product shipped the worse of the two.
   * One router, one answer.
   */
  const setVolume =
    /^(?:set\s+)?(?:the\s+)?(?:volume|sound)\s*(?:to|at|=)\s*(\d{1,3})\s*%?$/i.exec(lower) ??
    /^(?:set|change|put)\s+(?:the\s+)?(?:volume|sound)\s+(\d{1,3})\s*%?$/i.exec(lower);
  if (setVolume) {
    const level = Number(setVolume[1]);
    // Out of range is a typo, not a command. The model can ask what was meant.
    if (Number.isFinite(level) && level <= 100) {
      return {
        calls: [{ name: "system_volume", arguments: { action: "set", level } }],
        say: `Setting the volume to ${level}%.`,
        rule: "system.volume.set",
      };
    }
  }
  if (
    /^(?:mute|silence)(?:\s+(?:the\s+)?(?:pc|computer|sound|audio|volume|everything))?$/i.test(
      lower,
    )
  ) {
    return {
      calls: [{ name: "system_volume", arguments: { action: "mute" } }],
      say: "Muting.",
      rule: "system.volume.mute",
    };
  }
  if (/^(?:unmute|unsilence)(?:\s+(?:the\s+)?(?:pc|computer|sound|audio|volume))?$/i.test(lower)) {
    return {
      calls: [{ name: "system_volume", arguments: { action: "unmute" } }],
      say: "Unmuting.",
      rule: "system.volume.unmute",
    };
  }
  if (/^(?:turn\s+)?(?:the\s+)?(?:volume|sound)\s+up$|^louder$/i.test(lower)) {
    return {
      calls: [{ name: "system_volume", arguments: { action: "step", by: 10 } }],
      say: "Turning it up.",
      rule: "system.volume.up",
    };
  }
  if (/^(?:turn\s+)?(?:the\s+)?(?:volume|sound)\s+down$|^quieter$/i.test(lower)) {
    return {
      calls: [{ name: "system_volume", arguments: { action: "step", by: -10 } }],
      say: "Turning it down.",
      rule: "system.volume.down",
    };
  }

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

  /*
   * A SEARCH IS A SEARCH, WHATEVER IT IS ABOUT.
   *
   * FOUND BY THE TESTS FOR THIS FILE, AND IT PREDATES THE CONTRACTION FIX
   * BELOW. The observation rules are checked before the web rules, and several
   * of them match bare topic words: `cpu usage`, `how much memory`, `memory
   * usage`. So "google cpu usage in linux" was answered by reading THIS
   * computer's processor load, and "look up how much memory chrome needs" by
   * reading this computer's RAM. Both reported success, and both answered a
   * question nobody asked.
   *
   * An explicit search verb at the front of the sentence settles it: the user
   * is asking the web, not the machine. Checked here, once, rather than
   * bolted onto each observation pattern — the next observation rule someone
   * adds inherits this instead of re-introducing the bug.
   */
  const asksTheWeb =
    /^(?:search|google|look up|find out|browse)\b/i.test(lower) ||
    /\bsearch (?:the )?(?:web|internet|online)\b/i.test(lower);

  /* ---------------------------------------------------------- the machine --
   *
   * POSITION IS THE WHOLE CORRECTNESS ARGUMENT FOR THIS BLOCK, and it was
   * written at the bottom of the file first, where two of its rules were dead:
   *
   *   "go to sleep"  →  the `focus` rule matched `go to (.+)` and produced
   *                     `app_focus({name: "sleep"})`. OCADE hunted for a
   *                     window called "sleep", found none, and reported that.
   *   "lock it"      →  same shape, same result.
   *
   * They sit above the application rules now, and each is anchored to the WHOLE
   * string so it cannot swallow a sentence that merely contains its words.
   */
  if (/^(?:lock (?:the )?(?:pc|computer|screen|it)|lock)$/i.test(lower)) {
    return {
      calls: [{ name: "system_power", arguments: { action: "lock" } }],
      say: "Locking.",
      rule: "system.lock",
    };
  }
  if (
    /^(?:go to sleep|sleep(?: the (?:pc|computer))?|put (?:the )?(?:pc|computer) to sleep)$/i.test(
      lower,
    )
  ) {
    return {
      calls: [{ name: "system_power", arguments: { action: "sleep" } }],
      say: "Going to sleep.",
      rule: "system.sleep",
    };
  }
  /*
   * SHUTDOWN AND RESTART ARE DELIBERATELY ABSENT FROM THE FAST PATH.
   *
   * Every other rule here is instant BECAUSE it is reversible — a wrong volume
   * change costs a second. A wrong shutdown closes somebody's unsaved work with
   * no undo and no receipt. So those two go to the model, which reaches the
   * same tool through the approval gate, and the extra few seconds is the
   * cheapest insurance in the file.
   */

  const brightness =
    /^(?:set\s+)?(?:the\s+)?brightness\s*(?:to|at|=)?\s*(\d{1,3})\s*%?$/i.exec(lower) ??
    /^(?:set|change|put)\s+(?:the\s+)?brightness\s+(\d{1,3})\s*%?$/i.exec(lower);
  if (brightness) {
    const percent = Number(brightness[1]);
    if (Number.isFinite(percent) && percent <= 100) {
      return {
        calls: [{ name: "system_brightness", arguments: { action: "set", percent } }],
        say: `Setting the brightness to ${percent}%.`,
        rule: "system.brightness.set",
      };
    }
  }
  if (
    !asksTheWeb &&
    /^(?:what(?:'?s| is) (?:the |my )?wifi|which (?:wifi|network) am i on|wifi status)\??$/i.test(
      lower,
    )
  ) {
    return {
      calls: [{ name: "system_wifi", arguments: { action: "status" } }],
      say: "Checking the network.",
      rule: "system.wifi",
    };
  }

  if (
    !asksTheWeb &&
    /\b(?:what(?:'?s| is) (?:on )?(?:my |the )?clipboard|what did i (?:just )?copy)\b/i.test(lower)
  ) {
    return {
      calls: [{ name: "clipboard_read", arguments: {} }],
      say: "Reading the clipboard.",
      rule: "clipboard.read",
    };
  }

  if (
    !asksTheWeb &&
    /\bgames?\b/i.test(lower) &&
    /\b(?:updat\w*|installed|behind|out of date)\b/i.test(lower) &&
    // "update my games now" is the ACTION, and it is a mutation that ought to
    // go through the model rather than fire off a multi-gigabyte download from
    // a regular expression.
    !/\b(?:update (?:my |all )?games?\b|update all)\b/i.test(lower)
  ) {
    return {
      calls: [{ name: "game_list", arguments: {} }],
      say: "Checking your games.",
      rule: "games.list",
    };
  }

  if (
    /\b(?:phone dashboard|control (?:this|my) (?:pc|computer) from my phone|pair my phone)\b/i.test(
      lower,
    )
  ) {
    return {
      calls: [{ name: "phone_dashboard", arguments: { action: "start" } }],
      say: "Opening the phone dashboard.",
      rule: "remote.start",
    };
  }

  if (
    /\b(?:start|launch|run)\b.{0,20}\b(?:with (?:windows|my computer)|at (?:start ?up|login|boot))\b/i.test(
      lower,
    )
  ) {
    const off = /\b(?:don'?t|do not|stop|no longer|disable)\b/i.test(lower);
    return {
      calls: [{ name: "autostart", arguments: { enable: off ? "no" : "yes" } }],
      say: off ? "Turning off start-up." : "Starting with your computer from now on.",
      rule: "system.autostart",
    };
  }

  /* ------------------------------------------------------------- seeing --
   *
   * ABOVE THE OBSERVATION RULES, because "what can you SEE on my webcam"
   * matches `what (do|can) you see` and was answered by reading the SCREEN —
   * a confident description of the wrong thing entirely.
   */
  const mentionsCamera = /\b(?:webcam|my camera|the camera)\b/i.test(lower);
  if (mentionsCamera && /\b(?:look|see|check|what|show|through)\b/i.test(lower)) {
    return {
      calls: [{ name: "see", arguments: { source: "webcam" } }],
      say: "Looking through the camera.",
      rule: "vision.webcam",
    };
  }

  /* -------------------------------------------------------- observation --
   *
   * `what'?s` DID NOT MATCH `what is`, AND THAT WAS MOST OF THE PHRASINGS.
   *
   * FOUND LIVE, IN THE UI, AND IT LOOKED LIKE A DIFFERENT BUG ENTIRELY.
   * "what is on my screen" typed into Control + Work missed every pattern
   * here, fell through the whole router, and went to the model. The model
   * picked `screen_observe` and the right thing happened — about eleven
   * seconds later, with the panel sitting on "Thinking" the whole time. From
   * the outside that is indistinguishable from PC control being broken, and it
   * was reported as exactly that.
   *
   * The apostrophe was optional; the contraction was not. `what'?s` matches
   * "what's" and "whats" and nothing else, so the single most natural way to
   * write the sentence was the one spelling that missed. Same hole in the
   * system rule below, where "what is my cpu usage" happened to be caught by a
   * different alternative and "what is my battery level" was not.
   *
   * So the contraction is now a group — `what(?:'?s| is)` — applied to every
   * observation rule, and the tests below name the uncontracted form
   * explicitly for each one.
   */
  if (
    !asksTheWeb &&
    // The camera guard: `what (do|can) you see` is the natural way to ask about
    // BOTH, and only the screen rule existed — so every webcam question was
    // answered with a description of the desktop.
    !mentionsCamera &&
    /\b(what(?:'?s| is) on (my|the) screen|what (do|can) you see|read (my|the) screen|look at (my|the) screen|describe (my|the) screen|show me (my|the) screen)\b/i.test(
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
    !asksTheWeb &&
    /\b(what|which) (windows|apps|applications|programs) (are |do i have )?open\b|\blist (my |the )?(open )?windows\b|\bwhat(?:'?s| is) open\b/i.test(
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
    !asksTheWeb &&
    /*
     * `battery` STAYS QUALIFIED. An earlier draft of this fix allowed a bare
     * `\bbattery\b`, which reads fine until you notice the search rules are
     * checked BELOW this one: "search for battery replacement" would have been
     * answered by reading this computer's charge level. Every alternative here
     * has to be a sentence about THIS machine, not a sentence containing a
     * hardware word.
     */
    /\b(system status|how is my (pc|computer) doing|cpu usage|memory usage|how much (ram|memory)|battery (level|percentage|status)|why is my (pc|computer) slow|what(?:'?s| is) my (cpu|memory|ram|battery))\b/i.test(
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
    !asksTheWeb &&
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
  if (
    !asksTheWeb &&
    /\bwhat (applications|apps|programs) (are |do i have )?installed\b/i.test(lower)
  ) {
    return {
      calls: [{ name: "app_list_installed", arguments: {} }],
      say: "Checking what is installed.",
      rule: "observe.installed",
    };
  }

  /* ------------------------------------------------------------ whatsapp --
   *
   * "OPEN WHATSAPP AND SEARCH THE PERSON NAMED H" WENT TO THE MODEL AND HUNG.
   *
   * The engine could do every step of this — the WhatsApp skill opens the app,
   * resolves "H" against a chat list that labels rows with the whole row, and
   * opens the conversation — but none of it was REACHABLE. There was no tool
   * in the registry and no rule here, so the router split the sentence into
   * `app_open(whatsapp)` plus a remainder, handed the remainder to a 3B model,
   * and the model narrated. Asked three times, it never once searched.
   *
   * Both halves are deterministic, so both are emitted as calls. "whatsap" is
   * matched too, because that is what gets typed.
   */
  const whatsapp =
    /^(?:open|launch|start)?\s*(?:whats+app?|whatsap)\b[\s,]*(?:and\s+)?(?:then\s+)?(?:search|find|open|message|text)?\s*(?:for\s+)?(?:the\s+)?(?:person|contact|group|chat)?\s*(?:named\s+|called\s+)?(?<who>.+)?$/i.exec(
      text,
    );
  if (/\b(?:whats+app?|whatsap)\b/i.test(lower) && whatsapp?.groups) {
    /*
     * A CONTACT NAME IS NOT THE REST OF THE SENTENCE.
     *
     * "open whatsapp and search for Meta ai and ask a question about anything
     * computer related" captured ALL of that as the contact, so WhatsApp was
     * searched for the whole instruction and answered "No chats, contacts or
     * messages found" — correctly, because nobody is called that.
     *
     * The same split the app rules already use: the name stops at the first
     * connector, and everything after it is work this pass cannot finish, so
     * it goes back as a remainder for the model to turn into a message.
     */
    const raw = requireText(whatsapp.groups.who ?? null);
    const breakAt = raw ? raw.search(CLAUSE_BREAK) : -1;
    const who = contactName(breakAt >= 0 ? raw!.slice(0, breakAt) : raw);
    const rest =
      breakAt >= 0 && raw
        ? requireText(
            raw
              .slice(breakAt)
              .replace(/^(?:\s*[,;]\s*|\s*(?:and|then|&|so|but|plus|after that)\s+)+/i, ""),
          )
        : null;
    /*
     * THE VERB AND THE NAME ARE NOT PART OF THE MESSAGE.
     *
     * "message H hi" arrived at the composer intact and OCADE tried to write
     * something about the whole phrase. `messageClause` takes them off and
     * says which kind of leftover this is: words to type, or a job to do.
     */
    const clause = messageClause(rest, who);

    if (who) {
      return {
        calls: [
          { name: "whatsapp_open", arguments: {} },
          { name: "whatsapp_find_contact", arguments: { contact: who } },
          /*
           * WHEN THE USER GAVE THE WORDS, NO MODEL IS INVOLVED AT ALL.
           * "message H hi" is fully determined: open, find, type "hi". Sending
           * that through a language model can only make it slower and less
           * exact. Typing is separate from sending — the text lands in the box
           * and the person can see it before anything goes out.
           */
          ...(clause.literal
            ? [{ name: "whatsapp_type", arguments: { message: clause.literal } }]
            : []),
        ],
        say: clause.literal
          ? `Opening WhatsApp, finding ${who} and typing “${clause.literal}”.`
          : clause.brief
            ? `Opening WhatsApp and finding ${who}, then writing.`
            : `Opening WhatsApp and finding ${who}.`,
        rule: "whatsapp.find",
        /*
         * A LEFTOVER IN A CHAT IS ALMOST ALWAYS A MESSAGE TO WRITE.
         *
         * "…and ask a question about computers" is a writing brief, not a
         * second command, so it goes down the compose path — the model writes
         * the words and the skill types them. Handing it back as a plain
         * remainder sent it to a 3B model as an open instruction, which
         * narrated instead of typing.
         */
        ...(clause.brief ? { compose: { brief: clause.brief, app: "whatsapp" } } : {}),
        /*
         * NOT UNDERSTOOD, SO NOT TYPED.
         *
         * The chat is open — that part was unambiguous and is done. What was
         * meant to be SAID was not, so it goes to the model, which can read the
         * screen and decide. A guess here gets sent to another person and
         * cannot be recalled.
         */
        ...(clause.unclear ? { remainder: clause.unclear } : {}),
      };
    }
    return {
      calls: [{ name: "whatsapp_open", arguments: {} }],
      say: "Opening WhatsApp.",
      rule: "whatsapp.open",
    };
  }

  /* --------------------------------------------------------------- web --
   * BEFORE the application rules, because "open youtube and search for X" and
   * "open chrome" both begin with "open" and only one of them is an app launch.
   */
  const youtube =
    /\b(?:search (?:on |in )?youtube for|youtube search for|(?:find|search for|look for|play|put on)\s+(.+?)\s+on youtube|on youtube[, ]+(?:search for|find|play)|youtube)\b/i;
  if (/\byoutube\b/i.test(lower)) {
    /*
     * PLAY IS NOT SEARCH, AND EVERY RULE BELOW TREATED IT AS ONE.
     *
     * "play a english song in youtube" produced a results page and stopped.
     * Asked three different ways in one session, it never once played
     * anything. A person who says "play" wants sound; answering with a list of
     * links is not a partial success, it is the wrong action. So the play
     * verbs get their own rule and their own tool, which opens the first
     * result and skips the advert.
     *
     * "in youtube" is accepted alongside "on youtube" because people say both,
     * and the patterns below only matched "on" — which is why "play a english
     * song IN youtube" missed the router entirely and reached the model.
     */
    const playPatterns = [
      /\b(?:play|put on|listen to|stream)\s+(.+?)\s+(?:on|in|from)\s+youtube\b/i,
      /\b(?:on|in)\s+youtube[,: ]+(?:play|put on|listen to)\s+(.+)$/i,
      /\byoutube[,: ]+(?:play|put on|listen to)\s+(.+)$/i,
    ];
    if (/\b(?:play|put on|listen to|stream)\b/i.test(lower)) {
      for (const pattern of playPatterns) {
        const query = cleanQuery(pattern.exec(text)?.[1]);
        if (query) {
          return {
            calls: [{ name: "youtube_play", arguments: { query } }],
            say: `Playing “${query}” on YouTube.`,
            rule: "web.youtube.play",
          };
        }
      }
    }
    const patterns = [
      /\b(?:search (?:on |in )?youtube for|youtube search for|search youtube for)\s+(.+)$/i,
      /\b(?:play|put on|find|search for|look for)\s+(.+?)\s+(?:on|in)\s+youtube\b/i,
      /\bon youtube[,: ]+(?:search for|find|play|look for)\s+(.+)$/i,
      /\byoutube\s+(?:for\s+)?(.+)$/i,
    ];
    for (const pattern of patterns) {
      const query = cleanQuery(pattern.exec(text)?.[1]);
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

  /*
   * A QUESTION ABOUT THE REAL WORLD IS ANSWERED, NOT BROWSED.
   *
   * "who won the match last night", "what is the bitcoin price", "is it
   * raining in Chennai" -- none of these ask for a window. They ask for a
   * fact, and every one of them used to reach a 3B model whose weights are
   * months old, which answered confidently and wrongly. Sending them to a
   * raced live search costs a couple of seconds and is the difference between
   * stale and correct.
   *
   * THE BAR FOR BEING HERE IS "CANNOT BE ANSWERED FROM WEIGHTS".
   * Deliberately NOT every question. "what is a for loop" is answered better
   * and instantly by the model; routing it through a search would make OCADE
   * slower at the thing it is already good at. So this fires on the two
   * families that are genuinely time-bound: an explicit recency word (today,
   * latest, right now, current), or a live-data noun (price, weather, score,
   * news, forecast). Everything else falls through to the model, which is the
   * correct default.
   */
  const RECENCY =
    /\b(?:today|todays|tonight|right now|currently|current|latest|recent|this (?:week|month|year|morning|evening)|so far|as of now|up to date|breaking)\b/i;
  /*
   * WEATHER IS DELIBERATELY ABSENT, AND THAT IS NOT AN OVERSIGHT.
   *
   * It was here, and it broke the `weather` rule further down — which
   * calls a purpose-built tool that returns an actual forecast, rather
   * than the first paragraph of whatever page a search engine ranked
   * first. A generic rule that shadows a specific one is a downgrade
   * wearing the clothes of a feature, so anything with its own tool
   * stays out of this pattern.
   */
  const LIVE_DATA =
    /\b(?:price|prices|cost of|score|scores|news|headlines|stock|shares|exchange rate|who won|what happened|release date)\b/i;

  if (
    /^(?:who|what|when|where|which|how much|how many|is|are|did|does|do)\b/i.test(lower) &&
    (RECENCY.test(lower) || LIVE_DATA.test(lower))
  ) {
    const asked = requireText(text);
    if (asked) {
      return {
        calls: [{ name: "parallel_search", arguments: { query: asked } }],
        say: "Checking that against live sources.",
        rule: "web.ask.live",
      };
    }
  }

  const searchPatterns = [
    /^(?:search|google|look up|find out|find)\s+(?:the (?:web|internet)\s+)?(?:for\s+)?(.+)$/i,
    /\bsearch (?:the )?(?:web|internet|online) for\s+(.+)$/i,
    /\bwhat is (the )?(.+)$/i,
  ];
  if (/\b(search|google|look up)\b/i.test(lower)) {
    for (const pattern of searchPatterns) {
      const query = cleanQuery(pattern.exec(text)?.[1]);
      if (query) {
        return {
          // RACED, NOT QUEUED. Every engine at once, first good answer wins --
          // see `parallel_search`. The serial tool is still there for a caller
          // that wants one named engine, but a person asking a question wants
          // the answer, not a particular provider's opinion of it.
          calls: [{ name: "parallel_search", arguments: { query } }],
          say: `Looking that up: “${query}”.`,
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
  if (focus) {
    // Same shape guard as app.open, so "switch to Chrome and close the tabs"
    // focuses Chrome and leaves the rest to the model.
    const { name, remainder } = splitAppAndRemainder(focus[1]);
    if (name) {
      return {
        calls: [{ name: "app_focus", arguments: { name } }],
        say: remainder ? `Switching to ${name}, then carrying on.` : `Switching to ${name}.`,
        rule: "app.focus",
        ...(remainder ? { remainder } : {}),
      };
    }
  }

  /* ------------------------------------------------------------ writing --
   *
   * "IN WORDPAD TYPE ABOUT CARS IN 100 WORDS" — THE INSTRUCTION THAT HUNG.
   *
   * This went to the model, because it starts with neither "open" nor any
   * other rule's verb. The model then answered it the way it reads — as a
   * request for prose — and replied with an essay IN THE CHAT while WordPad sat
   * empty. Reported twice, and both times the panel stayed on "Thinking".
   *
   * The instructive part is that the SAME model writes the essay perfectly in
   * OCADE Chat. Nothing is wrong with its writing; what fails is being asked to
   * express "write this, then put it there" as a function call. A 3B model is
   * good at the first job and unreliable at the second, so this rule stops
   * asking it to do the second one at all.
   *
   * The router owns the mechanics — which window, which control, typing, the
   * read-back — because those are deterministic. The model is asked for the
   * one thing it is genuinely good at: the words. That is the whole fix, and
   * it is why this is a router rule rather than a better prompt.
   */
  const write =
    // "in wordpad type …" — app named first.
    /^(?:in|on|into|inside)\s+(?<app>[\w.+-]+(?:\s[\w.+-]+){0,2}?)[,:]?\s+(?:type|write|compose|draft)\s+(?<brief>.+)$/i.exec(
      text,
    ) ??
    /*
     * "… in notepad" — app named last, and the brief is GREEDY on purpose.
     * Non-greedy stopped at the first preposition, so "write a 100 word essay
     * on computers in notepad" resolved the app to "computers in notepad" and
     * the brief to "a 100 word essay". Greedy takes the LAST "in <app>", which
     * is the one that names a program.
     */
    /^(?:type|write|compose|draft)\s+(?<brief>.+)\s+(?:in|into|on)\s+(?<app>[\w.+-]+(?:\s[\w.+-]+){0,2})$/i.exec(
      text,
    ) ??
    /^(?:type|write|compose|draft)\s+(?<brief>.+)$/i.exec(text);
  if (write?.groups) {
    /*
     * LITERAL TEXT IS NOT A BRIEF. `type "hello world"` means those exact
     * characters and must not be sent to a model to be "written" — it would
     * come back as a paragraph about greetings.
     *
     * The quote test runs on the RAW capture, before `requireText`, because
     * `requireText` strips surrounding quotes as punctuation. Checking after it
     * meant no quoted string was ever recognised as literal, and every one of
     * them fell through to the model.
     */
    const raw = (write.groups.brief ?? "").trim();
    const quoted = /^["'“”«](.+)["'”»]$/.exec(raw);
    const brief = requireText(write.groups.brief);
    const app = requireText(write.groups.app ?? null);
    const literal = quoted ? requireText(quoted[1]) : null;
    const describesContent =
      !literal &&
      brief !== null &&
      /\b(about|on the topic of|regarding|essay|paragraph|note|poem|story|summary|letter|words?|lines?|sentences?)\b/i.test(
        brief,
      );

    if (literal) {
      return {
        calls: [
          ...(app ? [{ name: "app_focus", arguments: { name: app } }] : []),
          { name: "type_text", arguments: { text: literal } },
        ],
        say: app ? `Typing that into ${app}.` : "Typing that.",
        rule: "write.literal",
      };
    }
    if (brief && describesContent) {
      return {
        // Focusing first is not optional: typing goes to the foreground, and
        // the foreground is frequently the browser OCADE is running in.
        calls: app ? [{ name: "app_focus", arguments: { name: app } }] : [],
        say: app ? `Writing that into ${app}.` : "Writing that.",
        rule: "write.compose",
        compose: { brief, ...(app ? { app } : {}) },
      };
    }
  }

  /* ------------------------------------------------------------- folders --
   *
   * BEFORE the application rules, because "open downloads" matches both and
   * only one of them is right. Sent to `app_open` it becomes a hunt for an
   * installed program called "downloads folder", which fails, and the fallback
   * searched Bing for it — the machine answering a question about itself by
   * asking the internet.
   */
  const folder = /^(?:open|show|go to|browse)\s+(.+)$/i.exec(text);
  if (folder) {
    const { name, remainder } = splitAppAndRemainder(folder[1]);
    /*
     * The RAW capture is tried too, because `splitAppAndRemainder` applies the
     * shape rules for an APPLICATION name and rejects "this pc" on its vague
     * head — correct for programs, wrong for a folder that is genuinely called
     * that. A folder name is a lookup in a closed table, so it needs no shape
     * guard of its own.
     */
    const shell = shellFolderFor(name) ?? shellFolderFor(folder[1]);
    if (shell) {
      /*
       * "…AND OPEN THE FOLDER NAMED MUMMY" IS THE SECOND HALF, AND IT IS ALSO
       * DETERMINISTIC. It used to be handed to the model as a remainder, which
       * cannot work: a model has no way to click a row in a list it cannot
       * see, so Explorer opened and nothing else happened. Both halves are
       * emitted as calls here, so the sequence runs without a model at all.
       */
      const inner =
        /^(?:and\s+)?(?:then\s+)?(?:open|go into|enter|double[- ]?click)\s+(?:the\s+)?(?:folder\s+)?(?:named\s+|called\s+)?(.+)$/i.exec(
          remainder ?? "",
        );
      const item = inner ? requireText(inner[1]) : null;
      if (item) {
        return {
          calls: [
            { name: "folder_open", arguments: { folder: shell } },
            { name: "folder_item_open", arguments: { item } },
          ],
          say: `Opening ${name}, then ${item}.`,
          rule: "folder.open.item",
        };
      }
      return {
        calls: [{ name: "folder_open", arguments: { folder: shell } }],
        say: remainder ? `Opening ${name}, then carrying on.` : `Opening ${name}.`,
        rule: "folder.open",
        ...(remainder ? { remainder } : {}),
      };
    }
  }

  const open = /^(?:open|launch|start|run)\s+(.+)$/i.exec(text);
  if (open) {
    const { name, remainder } = splitAppAndRemainder(open[1]);
    if (name) {
      return {
        calls: [{ name: "app_open", arguments: { name } }],
        say: remainder ? `Opening ${name}, then carrying on.` : `Opening ${name}.`,
        rule: "app.open",
        // "open Notepad and write an essay" — the open runs here, the essay
        // goes to the model. Discarding this was the whole bug.
        ...(remainder ? { remainder } : {}),
      };
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

  /* -------------------------------------------------------- continuity --
   *
   * WHY THESE BELONG ON THE FAST PATH AT ALL.
   *
   * "Remember that I prefer short answers" is not a hard sentence. It has one
   * verb, one object and no ambiguity — and sending it to a model cost the same
   * eleven seconds "stop" used to cost, for a decision a regular expression
   * makes correctly every time. Worse, the model frequently answered it in
   * PROSE ("I'll remember that") without calling the tool, so the fact was
   * never written and the reply said it had been.
   *
   * Every rule below extracts a complete argument through `requireText` and
   * does not fire without one, exactly like the rules above it.
   */
  const remember =
    /^(?:remember|note|make a note)\s+(?:that\s+|this[:,]?\s+)?(.+)$/i.exec(text) ??
    /^don'?t forget\s+(?:that\s+)?(.+)$/i.exec(text);
  if (remember) {
    const fact = requireText(remember[1]);
    /*
     * "remember to buy milk at 18:00" is a REMINDER, not a fact. Stored as a
     * fact it is recalled forever and fires never, which is the one failure
     * mode where doing something is worse than doing nothing.
     *
     * THE FIRST VERSION OF THIS GUARD NEVER FIRED, AND THE TEST IS WHY IT IS
     * WRITTEN THIS WAY NOW. It ended in `\b(?:in \d|at \d|…)\b` — and the
     * trailing boundary can never match, because the character after the one
     * digit `\d` consumed is another digit. `at 18:00` got as far as `at 1`
     * and then failed on the boundary between "1" and "8", so every "remember
     * to … at 18:00" was silently filed as a permanent fact.
     */
    const looksLikeAReminder =
      /^to\s+\S/i.test(fact ?? "") &&
      /\b(?:in\s+\d+\s*\w|at\s+\d{1,2}[:.]\d{2}|tomorrow|tonight|later|this (?:evening|afternoon))\b/i.test(
        fact ?? "",
      );
    if (fact && !looksLikeAReminder) {
      return {
        calls: [{ name: "memory_remember", arguments: { fact } }],
        say: "Noted.",
        rule: "memory.remember",
      };
    }
  }

  const forget = /^forget\s+(?:that\s+|about\s+)?(.+)$/i.exec(text);
  if (forget) {
    const query = requireText(forget[1]);
    if (query) {
      return {
        calls: [{ name: "memory_forget", arguments: { query } }],
        say: `Forgetting ${query}.`,
        rule: "memory.forget",
      };
    }
  }

  if (
    /\bwhat do you (?:know|remember)(?: about me)?\b|\bshow (?:me )?(?:your |my )?memory\b|\bwhat(?:'?s| is) in your memory\b/i.test(
      lower,
    )
  ) {
    return {
      calls: [{ name: "memory_snapshot", arguments: {} }],
      say: "What I remember.",
      rule: "memory.snapshot",
    };
  }

  const recall = /^(?:what do you (?:know|remember) about|do you remember)\s+(.+)$/i.exec(text);
  if (recall) {
    const query = requireText(recall[1]);
    if (query) {
      return {
        calls: [{ name: "memory_recall", arguments: { query } }],
        say: `Checking what I know about ${query}.`,
        rule: "memory.recall",
      };
    }
  }

  /*
   * NAMES. Both directions, and they are different tools' arguments on the
   * same tool — the user's name and the assistant's.
   */
  const myName =
    /^(?:my name is|i'?m called|call me)\s+([\p{L}][\p{L}'-]{0,39})$/iu.exec(text) ?? null;
  if (myName) {
    const userName = requireText(myName[1]);
    if (userName) {
      return {
        calls: [{ name: "memory_identity", arguments: { userName } }],
        say: `I'll call you ${userName}.`,
        rule: "memory.identity.user",
      };
    }
  }
  const yourName =
    /^(?:your name is|i'?ll call you|call yourself|rename yourself(?: to)?|from now on you'?re)\s+([\p{L}\p{N}][\p{L}\p{N} '-]{0,31})$/iu.exec(
      text,
    );
  if (yourName) {
    const assistantName = requireText(yourName[1]);
    if (assistantName) {
      return {
        calls: [{ name: "memory_identity", arguments: { assistantName } }],
        say: `From now on I'm ${assistantName}.`,
        rule: "memory.identity.assistant",
      };
    }
  }

  if (
    /\b(?:brief(?:ing)? me|give me (?:my |the )?briefing|catch me up|what did i (?:do|work on) (?:yesterday|last time))\b/i.test(
      lower,
    )
  ) {
    return {
      calls: [{ name: "morning_briefing", arguments: {} }],
      say: "Your briefing.",
      rule: "presence.briefing",
    };
  }

  const watch =
    /^(?:watch|follow|keep an eye on|track)\s+(?:the\s+)?(?:news (?:on|about)\s+)?(.+)$/i.exec(text);
  if (watch && !/\b(?:my screen|the screen|this window)\b/i.test(lower)) {
    const topic = requireText(watch[1]);
    if (topic) {
      return {
        calls: [{ name: "topic_watch", arguments: { topic } }],
        say: `Watching ${topic}.`,
        rule: "presence.watch",
      };
    }
  }
  if (/\b(?:anything new|any news for me|check (?:my )?topics|what(?:'?s| is) new)\b/i.test(lower)) {
    return {
      calls: [{ name: "topic_check", arguments: {} }],
      say: "Checking what you follow.",
      rule: "presence.check",
    };
  }

  /* --------------------------------------------------------- reminders -- */
  /*
   * BOTH ARGUMENTS OR NOTHING. "Remind me to call mum" with no time is not a
   * reminder this pass can set — the engine would refuse the missing `when`,
   * and guessing at "in an hour" would fire at a moment nobody chose. It falls
   * through and the model asks.
   */
  const reminder =
    /^remind me\s+(?:to\s+)?(.+?)\s+(in\s+\d{1,4}\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)|at\s+\d{1,2}[:.]\d{2}\s*(?:am|pm)?|tomorrow\s+(?:at\s+)?\d{1,2}[:.]\d{2}\s*(?:am|pm)?)$/i.exec(
      text,
    );
  if (reminder) {
    const message = requireText(reminder[1]);
    const when = requireText(reminder[2]);
    if (message && when) {
      return {
        calls: [{ name: "reminder_set", arguments: { message, when } }],
        say: `Reminder set: ${message}.`,
        rule: "reminder.set",
      };
    }
  }
  if (/\b(?:list|show|what are)\s+(?:my\s+)?reminders\b|\bmy reminders\b/i.test(lower)) {
    return {
      calls: [{ name: "reminder_list", arguments: {} }],
      say: "Your reminders.",
      rule: "reminder.list",
    };
  }

  /* ----------------------------------------------------------- weather -- */
  if (/\b(?:weather|forecast|going to rain|is it raining)\b/i.test(lower) && !asksTheWeb) {
    const named = /\b(?:in|for|at)\s+([\p{L}][\p{L}\s'-]{1,39})$/iu.exec(text);
    const city = named ? requireText(named[1]) : null;
    return {
      calls: [{ name: "weather", arguments: city ? { city } : {} }],
      say: city ? `Checking the weather in ${city}.` : "Checking the weather.",
      rule: "web.weather",
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
