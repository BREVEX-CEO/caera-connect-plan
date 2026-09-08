/**
 * WHAT A SET OF OBSERVATIONS MEANS.
 *
 * PLAN.md §K asks for operational, degraded and outage states rather than a
 * binary. The difference is not decorative: "degraded" is what a person needs
 * to see when sign-in works and sync does not, and a two-state page has to
 * round that to either "everything is fine" — which is a lie to the person
 * whose sync is broken — or "OCADE is down", which is a lie to everybody else.
 *
 * Pure, and separate from the probing, because the rounding rules are the part
 * that is easy to get wrong and impossible to notice: an outage reported as
 * degraded reads as a minor inconvenience.
 */

export type ComponentState = "operational" | "degraded" | "outage" | "unknown";

/** Highest severity first, so `worst` is a max over this order. */
const SEVERITY: Record<ComponentState, number> = {
  outage: 3,
  degraded: 2,
  unknown: 1,
  operational: 0,
};

export interface ComponentObservation {
  componentId: string;
  state: ComponentState;
  /** What was actually seen. Never a restatement of the state. */
  detail: string;
  observedAt: string;
  /** True when the observation describes the visitor's device, not OCADE. */
  deviceSpecific?: boolean;
}

export type OverallState = "operational" | "degraded" | "outage" | "unknown";

/**
 * The single line at the top of the page.
 *
 * DEVICE-SPECIFIC OBSERVATIONS DO NOT COUNT TOWARDS IT. A visitor on a browser
 * with no WebGPU and no WebAssembly has a device problem, and rolling that into
 * "OCADE is degraded" tells everybody else something false about the service
 * because of one person's laptop.
 *
 * AN UNKNOWN IS NOT AN OPERATIONAL. A component nothing could measure is
 * reported as unknown, and the summary says so, because the alternative — a
 * green page built out of checks that did not run — is the specific failure a
 * status page exists to prevent.
 */
export function overallState(observations: readonly ComponentObservation[]): OverallState {
  const service = observations.filter((observation) => !observation.deviceSpecific);
  if (!service.length) return "unknown";
  let worst: ComponentState = "operational";
  for (const observation of service) {
    if (SEVERITY[observation.state] > SEVERITY[worst]) worst = observation.state;
  }
  /*
   * EVERY service component down is an outage; some of them down is degraded.
   * Rounding "one of five is down" up to "outage" makes the word useless the
   * first time it is needed for a real one.
   */
  if (worst === "outage") {
    const down = service.filter((observation) => observation.state === "outage").length;
    return down === service.length ? "outage" : "degraded";
  }
  return worst;
}

/** The sentence that goes with the state. Never more confident than the data. */
export function overallSummary(
  state: OverallState,
  observations: readonly ComponentObservation[],
): string {
  const service = observations.filter((observation) => !observation.deviceSpecific);
  const affected = service.filter(
    (observation) => observation.state === "outage" || observation.state === "degraded",
  ).length;
  switch (state) {
    case "operational":
      return `All ${service.length} checked components responded normally.`;
    case "degraded":
      return `${affected} of ${service.length} checked components is not responding normally.`;
    case "outage":
      return "No checked component responded normally.";
    default:
      return "OCADE could not check its components from here.";
  }
}

/** Human wording for one component, used by the page and by the feed alike. */
export const STATE_LABEL: Record<ComponentState, string> = {
  operational: "Operational",
  degraded: "Degraded",
  outage: "Outage",
  unknown: "Not checked",
};

/**
 * Decide a state from an HTTP response.
 *
 * A 5xx is an outage of that component; a 4xx means it answered, which is a
 * different failure — the component is up and refusing — and is reported as
 * degraded rather than down. A request that never completed is an outage,
 * because from the person's side there is no difference between "the server is
 * gone" and "the server cannot be reached".
 */
export function stateFromResponse(status: number | null): ComponentState {
  if (status === null) return "outage";
  if (status >= 500) return "outage";
  if (status >= 400) return "degraded";
  if (status >= 200) return "operational";
  return "unknown";
}
