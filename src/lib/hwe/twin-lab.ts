/**
 * HWE-11 — application digital-twin laboratory.
 *
 * SIMULATED. THIS IS NOT APPLICATION SUPPORT.
 * ==========================================
 * A twin is a scripted model of an application's behaviour, not the
 * application. It exists so route selection, unsafe-downgrade refusal, stale
 * targets, modal interruption, cancellation, emergency stop, recovery and
 * rollback can be exercised without a licensed application or a built native
 * companion. Nothing here may be promoted to REAL TARGET RUNTIME VERIFIED.
 *
 * What a twin adds over the P07 accessibility simulator is GROUND TRUTH. The
 * simulator models what a control surface *reports*; a twin also holds what is
 * actually true, and verifies an action against that instead of against the
 * executor's own claim. That distinction is the whole point: an automation
 * system that verifies by re-reading the surface it just acted on will confirm
 * its own mistakes.
 *
 * The route ladder is modelled honestly. Each twin declares which routes it
 * genuinely supports; asking for an unsupported route is refused rather than
 * silently downgraded, because a silent downgrade from `api` to `input` turns
 * a precise call into blind mouse movement — the single most dangerous thing
 * this system can do.
 */
import type { ActionRoute } from "../control/control-plane";

export const TWIN_PREFIX = "TWIN:";
const ev = (line: string) => `${TWIN_PREFIX} ${line}`;

/**
 * Preference order from the governed control hierarchy. Lower index = safer
 * and more precise.
 */
export const ROUTE_LADDER: readonly ActionRoute[] = [
  "api",
  "mcp",
  "plugin",
  "os_integration",
  "cli",
  "file",
  "dom",
  "accessibility",
  "native",
  "vision",
  "input",
];

export function routeRank(route: ActionRoute): number {
  const i = ROUTE_LADDER.indexOf(route);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

/**
 * Routes that act on coordinates rather than identified elements. Falling to
 * these is a real loss of precision and must be a deliberate, recorded step.
 */
export const COORDINATE_ROUTES: readonly ActionRoute[] = ["vision", "input"];

export type TwinKind =
  | "menu"
  | "form"
  | "virtualised_list"
  | "canvas"
  | "nested_dialogs"
  | "drag_and_drop"
  | "inaccessible_controls"
  | "mixed_dpi"
  | "changing_layout";

export type TwinFailure =
  | "unsupported_route"
  | "unsafe_downgrade"
  | "stale_target"
  | "target_not_found"
  | "modal_interrupted"
  | "cancelled"
  | "halted"
  | "not_permitted"
  | "verification_failed"
  | "offscreen_target"
  | "dpi_mismatch";

export interface TwinAction {
  /** Element the caller intends to act on. */
  targetId: string;
  /** What the caller wants to happen, checked against ground truth after. */
  intent: "activate" | "set_value" | "move";
  value?: string | number;
  /** Requested route. Refused if the twin cannot serve it. */
  route: ActionRoute;
  /** Explicit consent to drop to a coordinate route. */
  allowCoordinateFallback?: boolean;
}

export interface TwinReceipt {
  /** Always true — a twin can never produce real evidence. */
  simulated: true;
  twin: TwinKind;
  route: ActionRoute;
  /** Route originally asked for, when a fallback occurred. */
  requestedRoute?: ActionRoute;
  targetId: string;
  ok: boolean;
  failure?: TwinFailure;
  /** Ground-truth check, performed independently of the executor's claim. */
  verifiedAgainstGroundTruth: boolean;
  evidence: string[];
}

export interface TwinElement {
  id: string;
  label: string;
  /** Present in the surface the automation can see. */
  visible: boolean;
  enabled: boolean;
  stale?: boolean;
  /** Virtualised rows exist in the model but not in the surface until scrolled. */
  realised?: boolean;
  /** A canvas region with no accessible identity at all. */
  accessible?: boolean;
  value?: string | number;
}

export interface TwinOptions {
  permitted?: boolean;
  halted?: boolean;
  /** Applied before the action, to model interruption. */
  interruptWithModal?: boolean;
  /** Device pixel ratio, for the mixed-DPI twin. */
  devicePixelRatio?: number;
}

/**
 * One adversarial application twin.
 *
 * Ground truth lives in `truth`; the observable surface lives in `elements`.
 * They are deliberately allowed to disagree — that disagreement is what
 * catches an automation system that believes its own reports.
 */
export class ApplicationTwin {
  private readonly truth = new Map<string, string | number | boolean>();
  private elements: TwinElement[];
  private modalOpen = false;

  constructor(
    readonly kind: TwinKind,
    /** Routes this twin can genuinely serve. */
    readonly supportedRoutes: readonly ActionRoute[],
    elements: TwinElement[],
    private readonly opts: TwinOptions = {},
  ) {
    this.elements = elements.map((e) => ({ ...e }));
    for (const e of this.elements) if (e.value !== undefined) this.truth.set(e.id, e.value);
  }

  /** Ground truth, readable only by the verifier — never by the executor. */
  groundTruth(id: string): string | number | boolean | undefined {
    return this.truth.get(id);
  }

  surface(): TwinElement[] {
    return this.elements.filter((e) => !e.stale && e.realised !== false).map((e) => ({ ...e }));
  }

  /**
   * Pick the safest route this twin supports at or below the requested one.
   *
   * Returns null when the only remaining options are coordinate routes and the
   * caller has not consented to that loss of precision.
   */
  selectRoute(
    requested: ActionRoute,
    allowCoordinateFallback: boolean,
  ): { route: ActionRoute; downgraded: boolean } | { refused: TwinFailure; reason: string } {
    if (this.supportedRoutes.includes(requested)) {
      if (COORDINATE_ROUTES.includes(requested) && !allowCoordinateFallback) {
        return {
          refused: "unsafe_downgrade",
          reason: `"${requested}" acts on coordinates rather than an identified element and was not explicitly permitted.`,
        };
      }
      return { route: requested, downgraded: false };
    }
    // Fall DOWN the ladder only — never up to a route the caller did not ask
    // for, which would silently widen what the action can reach.
    const candidates = this.supportedRoutes
      .filter((r) => routeRank(r) > routeRank(requested))
      .sort((a, b) => routeRank(a) - routeRank(b));
    for (const c of candidates) {
      if (COORDINATE_ROUTES.includes(c) && !allowCoordinateFallback) {
        return {
          refused: "unsafe_downgrade",
          reason: `The only remaining route is "${c}", which acts on coordinates. Refusing to downgrade without explicit consent.`,
        };
      }
      return { route: c, downgraded: true };
    }
    return {
      refused: "unsupported_route",
      reason: `This application cannot be driven through "${requested}" or anything below it.`,
    };
  }

  /** Model a modal appearing mid-action. */
  interrupt(): void {
    this.modalOpen = true;
  }
  dismissModal(): void {
    this.modalOpen = false;
  }
  makeStale(id: string): void {
    const e = this.elements.find((x) => x.id === id);
    if (e) e.stale = true;
  }
  realise(id: string): void {
    const e = this.elements.find((x) => x.id === id);
    if (e) e.realised = true;
  }

  /**
   * Perform an action and verify it INDEPENDENTLY against ground truth.
   *
   * The executor's claim is never trusted: `ok` is set from the ground-truth
   * read, not from whether the mutation function threw.
   */
  perform(action: TwinAction, signal?: AbortSignal): TwinReceipt {
    const evidence: string[] = [];
    const base = {
      simulated: true as const,
      twin: this.kind,
      route: action.route,
      targetId: action.targetId,
      verifiedAgainstGroundTruth: false,
    };
    const refuse = (failure: TwinFailure, why: string): TwinReceipt => ({
      ...base,
      ok: false,
      failure,
      evidence: [...evidence, ev(`refused: ${why}`)],
    });

    if (this.opts.halted) return refuse("halted", "emergency stop is engaged");
    if (signal?.aborted) return refuse("cancelled", "cancelled before execution");
    if (this.opts.permitted === false) return refuse("not_permitted", "permission was not granted");

    const routing = this.selectRoute(action.route, action.allowCoordinateFallback === true);
    if ("refused" in routing) return refuse(routing.refused, routing.reason);
    const route = routing.route;
    if (routing.downgraded) {
      evidence.push(ev(`route "${action.route}" unavailable; using "${route}" instead`));
    }

    if (this.opts.interruptWithModal || this.modalOpen) {
      return {
        ...base,
        route,
        requestedRoute: action.route,
        ok: false,
        failure: "modal_interrupted",
        evidence: [...evidence, ev("refused: a modal dialog interrupted the action")],
      };
    }

    const el = this.elements.find((e) => e.id === action.targetId);
    if (!el) return refuse("target_not_found", `no element "${action.targetId}"`);
    if (el.stale)
      return refuse("stale_target", `"${action.targetId}" is stale and must be re-resolved`);
    if (el.realised === false) {
      // A virtualised row that has not been scrolled into existence cannot be
      // clicked by coordinate — there is nothing there yet.
      return refuse(
        "offscreen_target",
        `"${action.targetId}" is not realised; scroll it into view first`,
      );
    }
    if (el.accessible === false && !COORDINATE_ROUTES.includes(route)) {
      return refuse(
        "target_not_found",
        `"${action.targetId}" has no accessible identity; only a coordinate route could reach it`,
      );
    }
    if (!el.enabled) return refuse("target_not_found", `"${action.targetId}" is disabled`);

    // Mixed DPI: a coordinate route on a scaled display must scale, or it
    // misses. Modelled explicitly because it is a real and common failure.
    if (COORDINATE_ROUTES.includes(route)) {
      const dpr = this.opts.devicePixelRatio ?? 1;
      if (dpr !== 1 && action.intent === "move") {
        return refuse(
          "dpi_mismatch",
          `coordinates were supplied in logical pixels but this display scales at ${dpr}x`,
        );
      }
    }

    if (signal?.aborted) return refuse("cancelled", "cancelled mid-action; no change applied");

    // Apply to ground truth.
    switch (action.intent) {
      case "activate":
        this.truth.set(el.id, true);
        break;
      case "set_value":
        this.truth.set(el.id, action.value ?? "");
        break;
      case "move":
        this.truth.set(el.id, action.value ?? 0);
        break;
    }
    evidence.push(ev(`${action.intent} on "${el.id}" via ${route}`));

    // Independent verification: read ground truth, not the surface.
    const expected = action.intent === "activate" ? true : (action.value ?? "");
    const actual = this.truth.get(el.id);
    const verified = actual === expected;
    if (!verified) {
      return {
        ...base,
        route,
        requestedRoute: routing.downgraded ? action.route : undefined,
        ok: false,
        failure: "verification_failed",
        evidence: [
          ...evidence,
          ev(`ground truth is ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`),
        ],
      };
    }

    return {
      ...base,
      route,
      requestedRoute: routing.downgraded ? action.route : undefined,
      ok: true,
      verifiedAgainstGroundTruth: true,
      evidence: [...evidence, ev(`verified against ground truth: ${JSON.stringify(actual)}`)],
    };
  }

  /** Undo an action by restoring the recorded prior value. */
  rollback(id: string, priorValue: string | number | boolean | undefined): boolean {
    if (priorValue === undefined) {
      this.truth.delete(id);
      return this.truth.get(id) === undefined;
    }
    this.truth.set(id, priorValue);
    return this.truth.get(id) === priorValue;
  }
}

const el = (p: Partial<TwinElement> & { id: string }): TwinElement => ({
  label: p.id,
  visible: true,
  enabled: true,
  ...p,
});

/**
 * The laboratory: one twin per adversarial application shape.
 *
 * Route support differs per twin ON PURPOSE. A canvas application genuinely
 * has no accessible tree; a modern editor genuinely has an API. Giving every
 * twin the same routes would make route selection untestable.
 */
export function buildTwinLab(opts: TwinOptions = {}): Record<TwinKind, ApplicationTwin> {
  return {
    menu: new ApplicationTwin(
      "menu",
      ["api", "accessibility", "input"],
      [el({ id: "file_menu" }), el({ id: "save_item" }), el({ id: "quit_item", enabled: false })],
      opts,
    ),
    form: new ApplicationTwin(
      "form",
      ["dom", "accessibility", "input"],
      [el({ id: "name", value: "" }), el({ id: "email", value: "" }), el({ id: "submit" })],
      opts,
    ),
    virtualised_list: new ApplicationTwin(
      "virtualised_list",
      ["accessibility", "input"],
      [
        el({ id: "row_1", realised: true }),
        el({ id: "row_2", realised: true }),
        el({ id: "row_5000", realised: false }),
      ],
      opts,
    ),
    canvas: new ApplicationTwin(
      "canvas",
      // No accessible tree at all — only vision and scoped input can reach it.
      ["vision", "input"],
      [el({ id: "shape_a", accessible: false }), el({ id: "shape_b", accessible: false })],
      opts,
    ),
    nested_dialogs: new ApplicationTwin(
      "nested_dialogs",
      ["accessibility", "input"],
      [el({ id: "outer_ok" }), el({ id: "inner_ok" }), el({ id: "behind" })],
      opts,
    ),
    drag_and_drop: new ApplicationTwin(
      "drag_and_drop",
      ["api", "input"],
      [el({ id: "card_1", value: 0 }), el({ id: "column_b" })],
      opts,
    ),
    inaccessible_controls: new ApplicationTwin(
      "inaccessible_controls",
      ["vision", "input"],
      [el({ id: "custom_widget", accessible: false })],
      opts,
    ),
    mixed_dpi: new ApplicationTwin(
      "mixed_dpi",
      ["vision", "input"],
      [el({ id: "scaled_button", accessible: false, value: 0 })],
      { ...opts, devicePixelRatio: opts.devicePixelRatio ?? 2 },
    ),
    changing_layout: new ApplicationTwin(
      "changing_layout",
      ["accessibility", "input"],
      [el({ id: "moving_button" })],
      opts,
    ),
  };
}
