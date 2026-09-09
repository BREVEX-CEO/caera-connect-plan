/**
 * WHAT OCADE'S STATUS PAGE IS ALLOWED TO TALK ABOUT.
 *
 * PLAN.md §K asks for a status DATA AUTHORITY in place of hard-coded rows, and
 * the distinction matters for a reason that is not tidiness. The old page held
 * four component rows inside its own JSX, two of which asserted a state nothing
 * had measured — "Production Supabase target is not verified in this build" was
 * a sentence, not an observation — and one of which pointed people at the demo,
 * which no longer exists.
 *
 * A component here declares WHAT IT IS and HOW IT IS DECIDED. Nothing may
 * appear on the status page that does not name its own evidence, which makes
 * the invented row impossible to write: there is nowhere to put it.
 *
 * WHAT THIS DELIBERATELY DOES NOT CLAIM. Every probe here observes THIS
 * deployment from wherever it runs. That is not an independent status service,
 * and PLAN.md §K is explicit that OCADE must say so until one is configured
 * rather than implying a third party is watching. `STATUS_INDEPENDENCE` is that
 * statement, kept beside the catalogue so it cannot be forgotten when a
 * component is added.
 */

/** How a component's state is established. */
export type StatusEvidence =
  /** An HTTP request made now, whose response decides the state. */
  | { kind: "http"; path: string; expect: "ok" }
  /** A capability of the browser the person is using, checked in that browser. */
  | { kind: "browser-capability"; capability: string }
  /**
   * A configuration fact about this deployment. Never a health claim: it says
   * whether something is set up, which is a different question from whether it
   * is working.
   */
  | { kind: "configuration"; setting: string };

export interface StatusComponent {
  id: string;
  name: string;
  /** What a person loses when this is down. */
  description: string;
  evidence: StatusEvidence;
  /**
   * True when this component is observed in the visitor's own browser and is
   * therefore about their device rather than about OCADE.
   */
  deviceSpecific?: boolean;
}

/**
 * The catalogue.
 *
 * Ordered by what a person checks first when something is wrong: can I reach
 * it, can I sign in, is my data moving, does the on-device engine run.
 */
export const STATUS_COMPONENTS: readonly StatusComponent[] = [
  {
    id: "public-web",
    name: "Public web surface",
    description: "The website, sign-in page and public documents.",
    evidence: { kind: "http", path: "/api/health", expect: "ok" },
  },
  {
    id: "application",
    name: "Application delivery",
    description: "The signed-in workspace and its route bundles.",
    evidence: { kind: "http", path: "/", expect: "ok" },
  },
  {
    id: "account-authentication",
    name: "Account authentication",
    description: "Signing in, signing out and second-factor challenges.",
    /*
     * Configuration, not health. OCADE cannot probe the auth provider from a
     * status page without a request that either needs a credential or measures
     * nothing, and a green tick derived from "the URL is set" would be a claim
     * about somebody's ability to sign in that nothing checked.
     */
    evidence: { kind: "configuration", setting: "supabase" },
  },
  {
    id: "account-data",
    name: "Account data",
    description:
      "Where your conversations, projects, tasks and artifacts are kept, and what every device you sign in on reads them from.",
    evidence: { kind: "configuration", setting: "supabase" },
  },
  {
    id: "offline-intelligence",
    name: "Offline Intelligence",
    description: "The on-device model that answers without a network.",
    // Runs on the visitor's machine, so the only honest observation is of THEIR
    // browser. Labelled so nobody reads a red row as an OCADE outage.
    evidence: { kind: "browser-capability", capability: "webgpu-or-wasm" },
    deviceSpecific: true,
  },
];

/**
 * The independence statement, required by PLAN.md §K for as long as status is
 * served from OCADE's own origin.
 *
 * A status page hosted by the thing it reports on cannot report the one failure
 * that matters most — its own — and saying so is the difference between a
 * status page and a reassurance.
 */
export const STATUS_INDEPENDENCE = {
  independent: false,
  statement:
    "These checks run against OCADE from OCADE's own origin. They are not an independent status service: if OCADE is unreachable, this page is unreachable too and cannot report it.",
} as const;

export function findStatusComponent(id: string): StatusComponent | undefined {
  return STATUS_COMPONENTS.find((component) => component.id === id);
}
