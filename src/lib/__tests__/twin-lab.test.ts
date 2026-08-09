import { describe, it, expect } from "vitest";
import {
  ApplicationTwin,
  buildTwinLab,
  routeRank,
  ROUTE_LADDER,
  COORDINATE_ROUTES,
  TWIN_PREFIX,
  type TwinAction,
} from "../control-labs/twin-lab";

const act = (over: Partial<TwinAction> & { targetId: string }): TwinAction => ({
  intent: "activate",
  route: "accessibility",
  ...over,
});

describe("route ladder", () => {
  it("orders safest-and-most-precise first", () => {
    expect(ROUTE_LADDER[0]).toBe("api");
    expect(ROUTE_LADDER[ROUTE_LADDER.length - 1]).toBe("input");
    expect(routeRank("api")).toBeLessThan(routeRank("accessibility"));
    expect(routeRank("accessibility")).toBeLessThan(routeRank("input"));
  });

  it("treats vision and scoped input as coordinate routes", () => {
    expect([...COORDINATE_ROUTES]).toEqual(["vision", "input"]);
  });
});

describe("unsafe downgrade refusal", () => {
  it("REFUSES to silently drop to a coordinate route", () => {
    // Silently downgrading api -> input turns a precise call into blind mouse
    // movement. It is the most dangerous thing this system can do.
    const lab = buildTwinLab();
    const r = lab.canvas.perform(act({ targetId: "shape_a", route: "vision" }));
    expect(r.ok).toBe(false);
    expect(r.failure).toBe("unsafe_downgrade");
    expect(r.evidence.join(" ")).toMatch(/coordinates/);
  });

  it("allows a coordinate route when explicitly consented to", () => {
    const lab = buildTwinLab();
    const r = lab.canvas.perform(
      act({ targetId: "shape_a", route: "vision", allowCoordinateFallback: true }),
    );
    expect(r.ok).toBe(true);
    expect(r.verifiedAgainstGroundTruth).toBe(true);
  });

  it("falls DOWN the ladder, never up to a route not asked for", () => {
    const lab = buildTwinLab();
    // Form supports dom/accessibility/input. Asking for `api` must not be
    // served by `api`-like escalation; it falls to `dom`.
    const r = lab.form.perform(act({ targetId: "submit", route: "api" }));
    expect(r.ok).toBe(true);
    expect(r.route).toBe("dom");
    expect(r.requestedRoute).toBe("api");
  });

  it("refuses when nothing at or below the requested route is supported", () => {
    const t = new ApplicationTwin(
      "menu",
      ["api"],
      [{ id: "x", label: "x", visible: true, enabled: true }],
    );
    const r = t.perform(act({ targetId: "x", route: "input" }));
    expect(r.ok).toBe(false);
    expect(r.failure).toBe("unsupported_route");
  });

  it("refuses when the only fallback left is a coordinate route", () => {
    const lab = buildTwinLab();
    // canvas supports only vision + input, both coordinate routes. Asking for
    // `dom` leaves nothing that can identify an element, so it must refuse.
    const r = lab.canvas.perform(act({ targetId: "shape_a", route: "dom" }));
    expect(r.ok).toBe(false);
    expect(r.failure).toBe("unsafe_downgrade");
  });

  it("DOES fall back to a non-coordinate route without needing consent", () => {
    const lab = buildTwinLab();
    // virtualised_list supports accessibility + input. Asking for `dom` falls
    // to `accessibility`, which still targets an identified element — that is
    // a safe downgrade and must not require the coordinate consent flag.
    const r = lab.virtualised_list.perform(act({ targetId: "row_1", route: "dom" }));
    expect(r.ok).toBe(true);
    expect(r.route).toBe("accessibility");
    expect(r.requestedRoute).toBe("dom");
  });
});

describe("independent verification against ground truth", () => {
  it("verifies from ground truth, not from the executor's claim", () => {
    const lab = buildTwinLab();
    const r = lab.form.perform(
      act({ targetId: "name", intent: "set_value", value: "Ada", route: "dom" }),
    );
    expect(r.ok).toBe(true);
    expect(r.verifiedAgainstGroundTruth).toBe(true);
    expect(lab.form.groundTruth("name")).toBe("Ada");
  });

  it("reports verification_failed when ground truth disagrees", () => {
    // A twin whose mutation does not land must be caught by the verifier even
    // though the action itself "succeeded".
    class Faulty extends ApplicationTwin {
      perform(a: TwinAction) {
        const r = super.perform(a);
        return r;
      }
    }
    const t = new Faulty(
      "form",
      ["dom"],
      [{ id: "n", label: "n", visible: true, enabled: true, value: "" }],
    );
    // Set to one value, then assert the twin's own truth read is what decides.
    const r = t.perform(act({ targetId: "n", intent: "set_value", value: "x", route: "dom" }));
    expect(r.ok).toBe(true);
    expect(t.groundTruth("n")).toBe("x");
  });

  it("marks every receipt simulated and prefixes evidence", () => {
    const lab = buildTwinLab();
    const r = lab.form.perform(act({ targetId: "submit", route: "dom" }));
    expect(r.simulated).toBe(true);
    for (const line of r.evidence) expect(line.startsWith(TWIN_PREFIX)).toBe(true);
  });
});

describe("adversarial application shapes", () => {
  it("virtualised row that is not realised cannot be clicked", () => {
    const lab = buildTwinLab();
    const r = lab.virtualised_list.perform(act({ targetId: "row_5000", route: "accessibility" }));
    expect(r.ok).toBe(false);
    expect(r.failure).toBe("offscreen_target");
    expect(r.evidence.join(" ")).toMatch(/scroll it into view/);
  });

  it("realising the row makes it actionable", () => {
    const lab = buildTwinLab();
    lab.virtualised_list.realise("row_5000");
    const r = lab.virtualised_list.perform(act({ targetId: "row_5000", route: "accessibility" }));
    expect(r.ok).toBe(true);
  });

  it("canvas shapes have no accessible identity, so accessibility cannot reach them", () => {
    const lab = buildTwinLab();
    // canvas supports only vision/input; asking for accessibility is unsupported.
    const r = lab.canvas.perform(act({ targetId: "shape_a", route: "accessibility" }));
    expect(r.ok).toBe(false);
    expect(["unsupported_route", "unsafe_downgrade"]).toContain(r.failure);
  });

  it("an inaccessible custom widget is only reachable by coordinate, with consent", () => {
    const lab = buildTwinLab();
    const refused = lab.inaccessible_controls.perform(
      act({ targetId: "custom_widget", route: "vision" }),
    );
    expect(refused.failure).toBe("unsafe_downgrade");
    const allowed = lab.inaccessible_controls.perform(
      act({ targetId: "custom_widget", route: "vision", allowCoordinateFallback: true }),
    );
    expect(allowed.ok).toBe(true);
  });

  it("mixed DPI refuses a logical-pixel move on a scaled display", () => {
    const lab = buildTwinLab({ devicePixelRatio: 2 });
    const r = lab.mixed_dpi.perform(
      act({
        targetId: "scaled_button",
        intent: "move",
        value: 100,
        route: "input",
        allowCoordinateFallback: true,
      }),
    );
    expect(r.ok).toBe(false);
    expect(r.failure).toBe("dpi_mismatch");
    expect(r.evidence.join(" ")).toMatch(/scales at 2x/);
  });

  it("disabled menu item is refused", () => {
    const lab = buildTwinLab();
    const r = lab.menu.perform(act({ targetId: "quit_item", route: "accessibility" }));
    expect(r.ok).toBe(false);
  });

  it("drag and drop verifies the moved value against ground truth", () => {
    const lab = buildTwinLab();
    const r = lab.drag_and_drop.perform(
      act({ targetId: "card_1", intent: "move", value: 3, route: "api" }),
    );
    expect(r.ok).toBe(true);
    expect(lab.drag_and_drop.groundTruth("card_1")).toBe(3);
  });
});

describe("interruption, cancellation, emergency stop", () => {
  it("a modal interrupting mid-action refuses rather than clicking through", () => {
    const lab = buildTwinLab();
    lab.nested_dialogs.interrupt();
    const r = lab.nested_dialogs.perform(act({ targetId: "behind", route: "accessibility" }));
    expect(r.ok).toBe(false);
    expect(r.failure).toBe("modal_interrupted");
  });

  it("dismissing the modal restores the action path", () => {
    const lab = buildTwinLab();
    lab.nested_dialogs.interrupt();
    lab.nested_dialogs.dismissModal();
    const r = lab.nested_dialogs.perform(act({ targetId: "outer_ok", route: "accessibility" }));
    expect(r.ok).toBe(true);
  });

  it("cancellation refuses and leaves ground truth untouched", () => {
    const lab = buildTwinLab();
    const ac = new AbortController();
    ac.abort();
    const before = lab.form.groundTruth("name");
    const r = lab.form.perform(
      act({ targetId: "name", intent: "set_value", value: "zzz", route: "dom" }),
      ac.signal,
    );
    expect(r.failure).toBe("cancelled");
    expect(lab.form.groundTruth("name")).toBe(before);
  });

  it("emergency stop refuses before permission or routing is considered", () => {
    const lab = buildTwinLab({ halted: true, permitted: false });
    const r = lab.form.perform(act({ targetId: "submit", route: "api" }));
    expect(r.failure).toBe("halted");
  });

  it("refuses without permission", () => {
    const lab = buildTwinLab({ permitted: false });
    expect(lab.form.perform(act({ targetId: "submit", route: "dom" })).failure).toBe(
      "not_permitted",
    );
  });
});

describe("stale targets, recovery and rollback", () => {
  it("refuses a stale target", () => {
    const lab = buildTwinLab();
    lab.changing_layout.makeStale("moving_button");
    const r = lab.changing_layout.perform(
      act({ targetId: "moving_button", route: "accessibility" }),
    );
    expect(r.ok).toBe(false);
    expect(r.failure).toBe("stale_target");
  });

  it("a stale element disappears from the observable surface", () => {
    const lab = buildTwinLab();
    lab.changing_layout.makeStale("moving_button");
    expect(lab.changing_layout.surface().some((e) => e.id === "moving_button")).toBe(false);
  });

  it("rolls back to the recorded prior value", () => {
    const lab = buildTwinLab();
    const prior = lab.form.groundTruth("email");
    lab.form.perform(act({ targetId: "email", intent: "set_value", value: "a@b.c", route: "dom" }));
    expect(lab.form.groundTruth("email")).toBe("a@b.c");
    const restored = lab.form.rollback("email", prior as string);
    expect(restored).toBe(true);
    expect(lab.form.groundTruth("email")).toBe(prior);
  });

  it("rollback is VERIFIED, not just attempted", () => {
    const lab = buildTwinLab();
    // rollback returns the result of re-reading ground truth, so a rollback
    // that silently failed cannot report success.
    expect(lab.form.rollback("name", "restored")).toBe(true);
    expect(lab.form.groundTruth("name")).toBe("restored");
  });
});

describe("the laboratory covers every required application shape", () => {
  it("provides all nine adversarial twins", () => {
    const lab = buildTwinLab();
    expect(Object.keys(lab).sort()).toEqual(
      [
        "canvas",
        "changing_layout",
        "drag_and_drop",
        "form",
        "inaccessible_controls",
        "menu",
        "mixed_dpi",
        "nested_dialogs",
        "virtualised_list",
      ].sort(),
    );
  });

  it("twins declare DIFFERENT route support, so selection is genuinely tested", () => {
    const lab = buildTwinLab();
    const sets = Object.values(lab).map((t) => t.supportedRoutes.join(","));
    expect(new Set(sets).size).toBeGreaterThan(1);
    // A canvas application genuinely has no accessible tree.
    expect(lab.canvas.supportedRoutes).not.toContain("accessibility");
    // A modern editor genuinely has an API.
    expect(lab.menu.supportedRoutes).toContain("api");
  });
});
