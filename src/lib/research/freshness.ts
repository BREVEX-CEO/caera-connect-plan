/**
 * DOES ANSWERING THIS NEED TO KNOW WHAT DAY IT IS?
 *
 * WHY CHAT NEEDS THIS AT ALL. The whole research stack — ranking, evidence
 * snippets, the restricted HTTP layer, cited answers — exists and is reachable
 * from exactly one place: `/ocade/lab`. Ordinary Chat has never called any of
 * it. So a question like "who won the election last month" was answered from
 * whatever the local model remembered at training time, in the same confident
 * voice it uses for arithmetic, with nothing to tell the reader which kind of
 * answer they had just been given.
 *
 * Retrieval on EVERY message is not the fix. It is slow, it puts a network
 * request behind questions that plainly do not need one, and on a product
 * whose central promise is that nothing leaves the device it would quietly
 * make that promise false for "what is 17 times 4". So the router has to
 * decide, and this is the decision.
 *
 * THREE ANSWERS, NOT TWO. "Unknown" is a real outcome and is treated as
 * timeless: retrieval is opt-in on evidence, never on suspicion, because the
 * cost of a wrong "time-sensitive" is a network request the person did not ask
 * for, on a product sold on not making them.
 *
 * Pure and offline: a string in, a verdict out. No clock is read here — the
 * caller supplies `now` where a year has to be compared — so the same question
 * classifies the same way in a test as in production.
 */

export type Freshness = "timeless" | "time_sensitive" | "unknown";

export interface FreshnessVerdict {
  freshness: Freshness;
  /** The phrase that decided it. Shown in the receipt, never invented. */
  because: string;
}

/**
 * Words that only make sense relative to now.
 *
 * Matched on word boundaries: "current" must not fire on "currently
 * unemployed"'s neighbour "concurrent", and "latest" must not fire inside
 * "translated".
 */
const RELATIVE_TIME =
  /\b(today|tonight|yesterday|tomorrow|right now|currently|current|latest|newest|most recent|recently|so far this|this (week|month|year|morning|afternoon|evening)|last (week|month|year|night)|next (week|month|year)|nowadays|these days|as of now|up to date|up-to-date)\b/i;

/**
 * Subjects whose answer changes without anybody asking.
 *
 * A price, a score and a head of state are not facts a model holds; they are
 * readings taken at a moment. Including "who is the president" here is
 * deliberate — it is the canonical example of a question a model answers
 * fluently and wrongly, because it was true when the weights were made.
 */
const MOVING_SUBJECT =
  /\b(news|headlines?|stock (price|market)|share price|exchange rate|weather|forecast|temperature outside|score|scores|standings|fixtures?|who won|winner of|election results?|polls?|release date|version number|is .{0,24} (down|up|offline|available)|status of|price of|cost of|how much (is|does)|market cap|trending)\b/i;

/** Offices and roles that change hands. */
const OFFICE =
  /\b(president|prime minister|chancellor|ceo|chairman|chairwoman|pope|monarch|king|queen|champion|world record)\b.{0,40}\b(of|for|is|now|currently)\b|\bwho is the (current )?(president|prime minister|ceo|pope|monarch|champion)\b/i;

/**
 * Subjects that do not move, stated positively.
 *
 * Checked AFTER the moving ones, so "what is the latest version of Python"
 * stays time-sensitive rather than being rescued by "python".
 */
const SETTLED =
  /\b(what is|what are|define|definition of|meaning of|how do i|how to|explain|why does|why is|difference between|translate|calculate|convert|summari[sz]e|rewrite|proofread|write (me )?a|capital of|square root|multiplied by|divided by|plus|minus)\b/i;

/** A four-digit year, so "in 2019" can be read as history rather than news. */
const YEAR = /\b(19|20)\d{2}\b/;

/**
 * Classify one question.
 *
 * @param question What the person typed. Only this — never the conversation,
 *   because a follow-up inherits the routing decision of the turn that
 *   triggered it rather than being re-judged on three words.
 * @param now Used only to decide whether a mentioned year is in the past.
 */
export function classifyFreshness(question: string, now: Date = new Date()): FreshnessVerdict {
  const text = question.trim();
  if (text.length === 0) return { freshness: "unknown", because: "nothing was asked" };

  const relative = RELATIVE_TIME.exec(text);
  if (relative) {
    return {
      freshness: "time_sensitive",
      because: `"${relative[0]}" only means something relative to now`,
    };
  }

  /*
   * A YEAR IN THE PAST SETTLES IT, AND IT IS CHECKED BEFORE THE MOVING
   * SUBJECTS RATHER THAN AFTER.
   *
   * Below them it never fired on the case it was written for: "who won the
   * 2016 US election" matches `who won` and `election`, so it was routed to
   * the network to look up a result that has not changed in a decade. Naming a
   * finished year is the person telling you which reading they want, and that
   * is more specific than the subject being a moving one.
   *
   * It sits BELOW the relative-time check for the mirror-image reason: "since
   * 2019, what is the latest guidance" mentions a past year and is still a
   * question about today. The relative word is the more specific signal there.
   *
   * A future or current year settles nothing — the answer may not exist yet,
   * or may still be changing.
   */
  const year = YEAR.exec(text);
  if (year && Number(year[0]) < now.getUTCFullYear()) {
    return { freshness: "timeless", because: `asked about ${year[0]}, which has finished` };
  }

  const moving = MOVING_SUBJECT.exec(text);
  if (moving) {
    return {
      freshness: "time_sensitive",
      because: `"${moving[0].trim()}" is a reading taken at a moment, not a settled fact`,
    };
  }

  const office = OFFICE.exec(text);
  if (office) {
    return {
      freshness: "time_sensitive",
      because: "a role that changes hands was asked about without naming a date",
    };
  }

  if (SETTLED.test(text)) {
    return { freshness: "timeless", because: "asks for something that does not change" };
  }

  return { freshness: "unknown", because: "nothing in the question depends on the date" };
}

/**
 * Should Chat go and look this up?
 *
 * The question's own nature is only half of it. Being offline is the other
 * half, and it is not a failure to report as one: OCADE works offline by
 * design, so the honest behaviour is to answer from what the device knows and
 * SAY that the live part could not be checked — never to fail, and never to
 * answer as though it had checked.
 */
export interface ResearchRouting {
  research: boolean;
  /** What to tell the person, when there is something to tell them. */
  notice: string | null;
  verdict: FreshnessVerdict;
}

export function routeForFreshness(
  question: string,
  context: { online: boolean; researchAllowed: boolean; now?: Date },
): ResearchRouting {
  const verdict = classifyFreshness(question, context.now);

  if (verdict.freshness !== "time_sensitive") {
    return { research: false, notice: null, verdict };
  }

  if (!context.researchAllowed) {
    return {
      research: false,
      verdict,
      notice:
        "This question depends on current information, and looking things up is switched off. " +
        "Answering from what this device already knows, which may be out of date.",
    };
  }

  if (!context.online) {
    return {
      research: false,
      verdict,
      notice:
        "This question depends on current information and this device is offline, so OCADE " +
        "could not verify anything live. Answering from what it already knows, which may be " +
        "out of date.",
    };
  }

  return { research: true, notice: null, verdict };
}
