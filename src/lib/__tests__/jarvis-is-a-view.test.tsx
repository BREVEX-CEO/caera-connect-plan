// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * Jarvis is a presentation. The gate is that it cannot become a second engine.
 *
 * `PLAN.md` Phase 9: "Normal and Jarvis produce identical task history,
 * permissions, usage and receipts." `docs/DECISIONS.md` says the same thing in
 * stronger words — Jarvis owns presentation and audio-reactive behaviour, and
 * switching modes never creates a new mission.
 *
 * The way that is kept true is structural: ONE `useMission` in the room, passed
 * to both views. So these tests hold the structure, because a second hook is
 * the one edit that would break the guarantee while looking harmless in review.
 */

const ROOM = readFileSync("src/components/ocade/cowork/CoworkRoom.tsx", "utf8");
const JARVIS = readFileSync("src/components/ocade/cowork/JarvisStage.tsx", "utf8");
const PANEL = readFileSync("src/components/ocade/control/ControlWorkPanel.tsx", "utf8");

describe("one runtime, two views", () => {
  it("creates the mission in the room and nowhere else", () => {
    expect(ROOM).toMatch(/useMission\(brain\)/);
    // Neither view may make one of its own. This is the whole gate.
    expect(JARVIS).not.toMatch(/useMission\(/);
    expect(PANEL).not.toMatch(/useMission\(/);
  });

  it("hands the same mission to both views", () => {
    expect(ROOM).toMatch(/<JarvisStage\s+mission=\{mission\}/);
    expect(ROOM).toMatch(/<ControlWorkPanel\s+mission=\{mission\}/);
  });

  it("gives Jarvis no task, permit, permission or receipt logic of its own", () => {
    for (const forbidden of [
      "beginBilledRequest",
      "startRun(",
      "finishRun(",
      "runAgentTask",
      "runPlannedTask",
      "createPermissionContext",
      "acquireGenerationPermit",
    ]) {
      expect(JARVIS, forbidden).not.toContain(forbidden);
    }
  });

  it("drives every control through the shared mission", () => {
    for (const call of [
      "mission.stop",
      "mission.setPaused",
      "mission.takeOver",
      "mission.emergencyStop",
      "mission.answer",
      "mission.send",
      "mission.revise",
    ]) {
      expect(JARVIS, call).toContain(call);
    }
  });

  it("loads the stage lazily, so Normal does not pay for it", () => {
    expect(ROOM).toMatch(/lazy\(\(\) =>\s*import\("\.\/JarvisStage"\)/);
  });
});

describe("what Jarvis is allowed to be expressive with", () => {
  it("keeps the accent inside Jarvis", () => {
    /*
     * `docs/DESIGN.md`: "Jarvis may use user-selected luminous accent colours
     * inside the orb/voice visualization, but those accents are scoped to
     * Jarvis and should not leak into the general shell." Customer-facing
     * OCADE is monochrome, so every other surface renders the orb without an
     * accent and gets silver by definition.
     */
    const leaks = execSync("grep -rl 'accent=' src/components src/routes --include=*.tsx || true", {
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean)
      .filter((file) => !file.endsWith("JarvisStage.tsx"))
      // The orb and its canvas take the prop; they are what Jarvis passes it to.
      .filter((file) => !/OcadeOrb(Canvas)?\.tsx$/.test(file));
    expect(leaks).toEqual([]);
  });

  it("reads the microphone only while listening, and gives it back", () => {
    const LEVEL = readFileSync("src/lib/voice/use-audio-level.ts", "utf8");
    // An open track keeps the browser's recording indicator lit. Dropping the
    // reference is not enough; the tracks have to be stopped.
    expect(LEVEL).toMatch(/track\.stop\(\)/);
    expect(LEVEL).toMatch(/useEffect\(\(\) => stop, \[stop\]\)/);
    // Nothing is transcribed, stored or sent from this hook.
    for (const forbidden of ["fetch(", "MediaRecorder", "supabase", "localStorage"]) {
      expect(LEVEL, forbidden).not.toContain(forbidden);
    }
    // And the stage only drives the orb with it while the orb is listening.
    expect(JARVIS).toMatch(/state === "listening"/);
  });
});

/* ------------------------------------------------------- switching views -- */

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
  vi.resetModules();
});

describe("switching view does not start anything", () => {
  it("keeps one mission alive across a switch to Jarvis and back", async () => {
    /*
     * The runtime is replaced by a counter. What is under test is not what a
     * mission does — that is Phase 8's suite — but how many of them the room
     * creates while a person changes their mind about how to look at it.
     */
    let created = 0;
    const missionStub = {
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
      setMode: () => {},
      policyCeiling: { capabilities: new Set(), toolDomains: new Set(), withheldBy: new Map() },
      toolCount: 0,
      lastLatency: null,
      stop: () => {},
      setPaused: () => {},
      takeOver: () => {},
      emergencyStop: async () => 0,
      answer: () => {},
      revise: () => {},
      send: async () => {},
      mic: { enabled: false, deviceId: null, listening: false, devices: [], detail: "" },
      setMicEnabled: async () => {},
      selectMicDevice: async () => {},
      refreshAudio: async () => {},
      speak: async () => {},
      release: async () => {},
    };

    /*
     * A mission with an identity that is minted ONCE PER MOUNT. That is what
     * makes the assertion at the end mean something: a re-render returns the
     * same id, and a second `useMission` — a Jarvis route with its own hook,
     * say — would mint a second one and the views would be looking at
     * different missions.
     */
    const seen: string[] = [];
    vi.doMock("@/lib/work/use-mission", () => ({
      useMission: () => {
        const id = useRef<string | null>(null);
        if (!id.current) {
          created += 1;
          id.current = `mission-${created}`;
        }
        return { ...missionStub, id: id.current };
      },
    }));
    vi.doMock("@/lib/work/use-mission-brain", () => ({
      useMissionBrain: () => ({ brain: async () => "", warm: () => {} }),
    }));
    // The panel and the stage are heavy screens with their own dependencies;
    // this test is about the room's arithmetic, so they are stood in for.
    vi.doMock("@/components/ocade/control/ControlWorkPanel", () => ({
      ControlWorkPanel: ({
        mission,
        presentation,
      }: {
        mission: { id: string };
        presentation?: React.ReactNode;
      }) => {
        seen.push(mission.id);
        return (
          <div>
            <span>normal view</span>
            {presentation}
          </div>
        );
      },
    }));
    vi.doMock("@/components/ocade/cowork/JarvisStage", () => ({
      JarvisStage: ({
        mission,
        onReturnToNormal,
      }: {
        mission: { id: string };
        onReturnToNormal: () => void;
      }) => {
        seen.push(mission.id);
        return (
          <button type="button" onClick={onReturnToNormal}>
            jarvis view
          </button>
        );
      },
    }));

    const { CoworkRoom } = await import("@/components/ocade/cowork/CoworkRoom");

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(<CoworkRoom />);
    });

    expect(container.textContent).toContain("normal view");

    // To Jarvis…
    const toJarvis = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Jarvis",
    );
    expect(toJarvis).toBeDefined();
    await act(async () => {
      toJarvis!.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain("jarvis view");

    // …and back.
    const toNormal = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "jarvis view",
    );
    await act(async () => {
      toNormal!.click();
    });
    expect(container.textContent).toContain("normal view");

    // Both views ran, and every one of them was handed the same mission.
    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect(new Set(seen).size).toBe(1);
    expect(created).toBe(1);
  });
});
