// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CoworkCommandCenter } from "@/components/ocade/cowork/CoworkCommandCenter";
import type { Mission } from "@/lib/work/use-mission";

/**
 * The inspector DESIGN.md asks for, and the three claims it must never make.
 *
 * The Command Center is where a person goes when something looks wrong, which
 * makes it the one panel that cannot be optimistic: it must not say the
 * computer is connected when nothing answered, must not say a step was
 * confirmed when nothing was checked, and must not say a step was NOT
 * confirmed when there was nothing to confirm. Those are three different
 * sentences and the product rule is that OCADE never collapses them.
 */

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

/**
 * A mission in whatever state the case needs.
 *
 * Cast rather than built: `Mission` is the whole runtime, and an inspector
 * test that had to construct a working agent loop to check a sentence would be
 * testing the loop. Every field these cases read is set explicitly below.
 */
function missionWith(partial: Partial<Mission>): Mission {
  return {
    start: null,
    connecting: false,
    connect: async () => {},
    phase: "idle",
    busy: false,
    paused: false,
    turns: [],
    live: [],
    approval: null,
    handedOver: false,
    activeRunCount: 0,
    error: null,
    mode: "prompt",
    policyCeiling: { capabilities: new Set(), toolDomains: new Set(), withheldBy: new Map() },
    toolCount: 12,
    lastLatency: null,
    ...partial,
  } as unknown as Mission;
}

async function render(mission: Mission) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <CoworkCommandCenter
        mission={mission}
        extension={null}
        extensionChecking={false}
        onRecheckExtension={() => {}}
      />,
    );
  });
  return container!.textContent ?? "";
}

describe("what the Command Center says about the machine", () => {
  it("does not claim a computer or a browser it has not heard from", async () => {
    const text = await render(missionWith({}));

    expect(text).toContain("Not asked yet");
    expect(text).toContain("Not connected");
    expect(text).not.toContain("Connected —");
  });

  it("names who is holding the keyboard, and puts handover above everything", async () => {
    // Taken over: the panel is idle AND the user has the machine. Reporting
    // "nobody" here would be true of the runtime and wrong about the room.
    const text = await render(missionWith({ handedOver: true, busy: false }));
    expect(text).toContain("You have the keyboard and mouse");
  });

  it("does not call a paused run working", async () => {
    const text = await render(missionWith({ busy: true, paused: true }));
    expect(text).toContain("Paused");
    expect(text).not.toContain("OCADE, on this computer");
  });

  it("says when other work is running, even though this room is idle", async () => {
    const text = await render(missionWith({ activeRunCount: 2 }));
    expect(text).toContain("2 running");
  });

  it("names what the workspace withheld rather than implying full powers", async () => {
    const text = await render(
      missionWith({
        policyCeiling: {
          capabilities: new Set(),
          toolDomains: new Set(["os_app"]),
          withheldBy: new Map(),
        } as Mission["policyCeiling"],
      }),
    );
    expect(text).toContain("1 withheld");
    expect(text).toContain("os_app");
  });
});

describe("what the Command Center says about the work", () => {
  const turnWith = (entries: { verified?: boolean; kind: "done" | "problem" }[]) => [
    {
      id: "t1",
      role: "ocade" as const,
      text: "Done.",
      entries: entries.map((entry, index) => ({
        id: `e${index}`,
        kind: entry.kind,
        label: `Step ${index}`,
        detail: "",
        ...(entry.verified === undefined ? {} : { verified: entry.verified }),
      })),
    },
  ];

  it("keeps confirmed, not confirmed and nothing-to-confirm apart", async () => {
    const text = await render(
      missionWith({
        turns: turnWith([
          { kind: "done", verified: true },
          { kind: "done", verified: false },
          { kind: "done" },
          { kind: "problem" },
        ]) as unknown as Mission["turns"],
      }),
    );

    expect(text).toContain("(confirmed)");
    expect(text).toContain("(not confirmed on screen)");
    // A read had nothing to check. Reporting it as unconfirmed would make the
    // strongest claim OCADE can make look identical to its weakest.
    expect(text).toContain("(nothing to confirm)");
    expect(text).toContain("(failed)");
  });

  it("shows the current action while one is running, and says so when none is", async () => {
    const idle = await render(missionWith({}));
    expect(idle).toContain("Nothing running");

    await act(async () => root?.unmount());
    container?.remove();

    const acting = await render(
      missionWith({
        live: [
          { id: "l1", kind: "acting", label: "Opening Notepad", detail: "" },
        ] as unknown as Mission["live"],
      }),
    );
    expect(acting).toContain("Opening Notepad");
  });
});
