import { describe, expect, it } from "vitest";
import {
  browserAction,
  computerAction,
  describeAction,
  deviceAction,
  hostOf,
  jarvisTools,
} from "../protocol";
import {
  isAllowed,
  isPrivateHost,
  needsConfirmation,
  refuseAction,
  siteAllowed,
  type PermissionRow,
} from "../permissions";
import { heard, voiceCommand } from "../use-voice";
import cases from "../../../jarvis-runtime/tests/command_cases.json";

const row = (
  capability: string,
  allowed: boolean,
  device_id: string | null = null,
): PermissionRow => ({
  capability,
  allowed,
  device_id,
});

describe("the action contract", () => {
  it("accepts semantic actions and refuses anything else", () => {
    expect(
      browserAction.safeParse({ action: "click", ref: "e3", observationId: "o2" }).success,
    ).toBe(true);
    expect(
      browserAction.safeParse({ action: "click", ref: "button", observationId: "o2" }).success,
    ).toBe(false);
    expect(browserAction.safeParse({ action: "click_at", x: 1, y: 2 }).success).toBe(false);
    expect(
      browserAction.safeParse({ action: "set_permission", capability: "master" }).success,
    ).toBe(false);
    expect(
      browserAction.safeParse({
        action: "type",
        ref: "e1",
        observationId: "o1",
        text: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });

  it("reads hosts only from web addresses", () => {
    expect(hostOf("Example.com/a")).toBe("example.com");
    expect(hostOf("https://shop.example.com/x")).toBe("shop.example.com");
    expect(hostOf("file:///etc/passwd")).toBeNull();
    expect(hostOf("javascript:alert(1)")).toBeNull();
  });

  it("describes actions without echoing what the model typed", () => {
    const summary = describeAction({
      action: "type",
      ref: "e1",
      observationId: "o1",
      text: "secret",
    });
    expect(summary).not.toContain("secret");
  });

  it("offers no tool that changes permissions, and memory only when enabled", () => {
    const names = jarvisTools(false).map((tool) => tool.name);
    expect(names).toEqual([
      "start_task",
      "browser",
      "computer",
      "stop_task",
      "docs",
      "finish_task",
      "schedule",
    ]);
    expect(jarvisTools(true).map((tool) => tool.name)).toContain("remember");
    // While the person is away nothing is remembered and nothing new is scheduled.
    expect(jarvisTools(false, false).map((tool) => tool.name)).toEqual([
      "start_task",
      "browser",
      "computer",
      "stop_task",
      "docs",
      "finish_task",
    ]);
  });
});

describe("permissions", () => {
  it("has safe defaults", () => {
    expect(isAllowed([], "master")).toBe(true);
    expect(isAllowed([], "browser")).toBe(true);
    expect(isAllowed([], "browser_real")).toBe(false);
    expect(isAllowed([], "memory")).toBe(false);
    expect(isAllowed([], "computer_control")).toBe(false);
  });

  it("lets a device decision override the account default for that device only", () => {
    const rows = [row("browser", true), row("browser", false, "d1")];
    expect(isAllowed(rows, "browser", "d1")).toBe(false);
    expect(isAllowed(rows, "browser", "d2")).toBe(true);
  });

  it("refuses everything when the master switch is off", () => {
    expect(
      refuseAction([row("master", false)], {
        deviceId: "d1",
        mode: "isolated",
        action: { action: "observe" as const },
      })?.capability,
    ).toBe("master");
  });

  it("refuses the real browser unless allowed", () => {
    expect(
      refuseAction([], { deviceId: "d1", mode: "real", action: { action: "observe" as const } })
        ?.capability,
    ).toBe("browser_real");
    expect(
      refuseAction([row("browser_real", true)], {
        deviceId: "d1",
        mode: "real",
        action: { action: "observe" as const },
      }),
    ).toBeNull();
  });

  it("honours a turned-off site and its subdomains", () => {
    const rows = [row("site:example.com", false)];
    expect(siteAllowed(rows, "https://example.com")).toBe(false);
    expect(siteAllowed(rows, "https://shop.example.com/cart")).toBe(false);
    expect(siteAllowed(rows, "https://example.org")).toBe(true);
    expect(siteAllowed(rows, "file:///etc/passwd")).toBe(false);
    expect(
      refuseAction(rows, {
        deviceId: "d",
        mode: "isolated",
        action: { action: "open" as const, url: "example.com" },
      })?.capability,
    ).toBe("site");
  });
});

describe("computer actions", () => {
  const open = (name: string) => ({ action: "open_app" as const, name });
  const run = (command: string) => ({ action: "run" as const, command });

  it("need their own permission and a device that offers them", () => {
    const action = { action: "file_read" as const, path: "notes.md" };
    expect(refuseAction([], { deviceId: "d", mode: "isolated", action })?.capability).toBe("files");
    expect(
      refuseAction([row("files", true, "d")], {
        deviceId: "d",
        mode: "isolated",
        action,
        offered: { files: false },
      })?.message,
    ).toContain("not available on this device");
    expect(
      refuseAction([row("files", true, "d")], {
        deviceId: "d",
        mode: "isolated",
        action,
        offered: { files: true },
      }),
    ).toBeNull();
  });

  it("use the app rules (Devices, Apps and websites) as Always, Ask or Never", () => {
    const rows = [row("apps", true), row("app:notepad", true), row("app:terminal", false)];
    expect(needsConfirmation(rows, open("Notepad"))).toBe(false);
    expect(needsConfirmation(rows, open("Calculator"))).toBe(true);
    expect(
      refuseAction(rows, { deviceId: "d", mode: "isolated", action: open("Terminal") })?.capability,
    ).toBe("app");
  });

  it("run a task's own builds, tests and git reads at once, and ask before anything else", async () => {
    const { commandClass } = await import("../protocol");
    // The same cases the Device Agent decides (jarvis-runtime/tests/test_computer.py).
    for (const { command, class: expected } of cases) {
      expect(commandClass(command), command).toBe(expected);
      expect(needsConfirmation([], run(command)), command).toBe(
        !["inert", "routine"].includes(expected),
      );
    }
    expect(needsConfirmation([], { action: "file_delete", path: "a.txt" })).toBe(true);
    expect(needsConfirmation([], { action: "file_trash", path: "a.txt" })).toBe(false);
    expect(needsConfirmation([], { action: "system", op: "restart" })).toBe(true);
  });

  it("only accept a screen click tied to a screen observation", () => {
    expect(
      deviceAction.safeParse({ action: "screen_click", x: 1, y: 2, observationId: "s3" }).success,
    ).toBe(true);
    expect(deviceAction.safeParse({ action: "screen_click", x: 1, y: 2 }).success).toBe(false);
    expect(deviceAction.safeParse({ action: "open_app", name: "calc; rm -rf /" }).success).toBe(
      false,
    );
  });
});

describe("the wake phrase", () => {
  it("passes everything through when the wake phrase is off", () => {
    expect(heard("what time is it", false)).toBe("what time is it");
  });

  it("sends only what follows Hey OCADE when it is on", () => {
    expect(heard("Hey OCADE, open the news", true)).toBe("open the news");
    expect(heard("hey o cade what's up", true)).toBe("what's up");
    expect(heard("open the news", true)).toBeNull();
    expect(heard("Hey OCADE", true)).toBeNull();
  });

  it("wakes for OCADE on its own too, and not for words that only sound close", () => {
    expect(heard("OCADE, what's the weather", true)).toBe("what's the weather");
    expect(heard("O'Kade open my mail", true)).toBe("open my mail");
    for (const said of ["arcade games", "okay google", "a cascade of errors", "Ocado delivery"]) {
      expect(heard(said, true), said).toBeNull();
    }
  });
  it("treats a bare Stop, Pause, Continue or Cancel as a control, never a message", () => {
    expect(voiceCommand("Stop.")).toBe("stop");
    expect(voiceCommand("pause")).toBe("pause");
    expect(voiceCommand("Continue")).toBe("continue");
    expect(voiceCommand("cancel")).toBe("end");
    expect(voiceCommand("stop the music on YouTube")).toBeNull();
    expect(voiceCommand("what does pause mean")).toBeNull();
  });
});

describe("private networks", () => {
  it("recognises loopback, private and local names", () => {
    for (const host of [
      "localhost",
      "127.0.0.1",
      "10.0.0.8",
      "192.168.1.1",
      "172.20.0.1",
      "printer.local",
      "169.254.1.1",
      "100.64.0.1",
      "[::ffff:a00:1]",
      "[64:ff9b::a00:1]",
    ]) {
      expect(isPrivateHost(host), host).toBe(true);
    }
    for (const host of ["example.com", "172.32.0.1", "8.8.8.8", "100.128.0.1"]) {
      expect(isPrivateHost(host)).toBe(false);
    }
  });

  it("refuses a private address until the person allows it", () => {
    expect(siteAllowed([], "http://192.168.1.1/admin")).toBe(false);
    expect(
      refuseAction([], {
        deviceId: "d",
        mode: "isolated",
        action: { action: "open" as const, url: "http://127.0.0.1:8799" },
      })?.message,
    ).toContain("private network");
    expect(siteAllowed([row("site:192.168.1.1", true)], "http://192.168.1.1/admin")).toBe(true);
    expect(siteAllowed([row("site:1.1", true)], "http://192.168.1.1/")).toBe(false);
  });
});

describe("screen input carries the observation it was planned against", () => {
  it("keeps observationId on typing, keys and scrolling, and refuses them without it", async () => {
    const { computerAction } = await import("../protocol");
    for (const action of [
      { action: "screen_type", text: "hello" },
      { action: "screen_keys", keys: ["ctrl", "s"] },
      { action: "screen_scroll", direction: "down" },
    ]) {
      expect(computerAction.safeParse(action).success).toBe(false);
      const parsed = computerAction.parse({ ...action, observationId: "s7" });
      expect(parsed).toMatchObject({ observationId: "s7" });
    }
  });
});

describe("spreadsheet and file actions", () => {
  it("accepts structured workbook edits and refuses formulas that leave the workbook", async () => {
    const { computerAction, capabilityFor, describeAction } = await import("../protocol");
    const edit = computerAction.parse({
      action: "sheet_edit",
      path: "sales.xlsx",
      sheet: "Orders",
      ops: [
        { op: "fill", range: "E2:E7", formula: "=C2*D2" },
        { op: "set", cell: "A9", value: "see https://example.com later" },
        { op: "format", range: "D2:F8", numberFormat: "$#,##0.00", border: "thin" },
      ],
    });
    expect(capabilityFor(edit)).toBe("files");
    expect(describeAction(edit)).toBe("Updating the workbook sales.xlsx (3 changes)");
    for (const bad of [
      { op: "set", cell: "A1", value: '=WEBSERVICE("https://x.test")' },
      { op: "fill", range: "A1:A2", formula: "=[Other.xlsx]S!A1" },
      { op: "fill", range: "A1:A2", formula: "=cmd|' /C calc'!A0" },
      { op: "fill", range: "A1:A2", formula: "C2*D2" },
      { op: "set", cell: "A1:ZZZZ9", value: 1 },
    ]) {
      expect(
        computerAction.safeParse({ action: "sheet_edit", path: "a.xlsx", ops: [bad] }).success,
        JSON.stringify(bad),
      ).toBe(false);
    }
  });

  it("file moves need both ends and count as file work", async () => {
    const { computerAction, capabilityFor } = await import("../protocol");
    expect(computerAction.safeParse({ action: "file_move", path: "a.txt" }).success).toBe(false);
    expect(
      capabilityFor(computerAction.parse({ action: "file_copy", path: "a.txt", to: "b" })),
    ).toBe("files");
  });
});

describe("files through the browser", () => {
  it("needs both the browser and the work folder", async () => {
    const { browserAction } = await import("../protocol");
    const { refuseAction } = await import("../permissions");
    const action = browserAction.parse({
      action: "upload",
      ref: "e3",
      observationId: "o2",
      path: "cv.pdf",
    });
    const input = { deviceId: "d1", mode: "isolated" as const, action, offered: { files: true } };
    expect(refuseAction([], input)?.capability).toBe("files");
    const files = { capability: "files", allowed: true, device_id: null };
    expect(refuseAction([files], input)).toBeNull();
    const noBrowser = { capability: "browser", allowed: false, device_id: null };
    expect(refuseAction([files, noBrowser], input)?.capability).toBe("browser");
    expect(refuseAction([files], { ...input, offered: { files: false } })?.capability).toBe(
      "files",
    );
    // A file leaving for a website is the person's decision, every time.
    const { needsConfirmation } = await import("../permissions");
    expect(needsConfirmation([files], action)).toBe(true);
  });
});

describe("settings, status and undo", () => {
  it("are typed, need the right permission and never wait for a confirmation", async () => {
    const { computerAction, capabilityFor, describeAction } = await import("../protocol");
    const { needsConfirmation } = await import("../permissions");
    const volume = computerAction.parse({ action: "setting", name: "volume", level: 30 });
    const dark = computerAction.parse({ action: "setting", name: "dark_mode", on: true });
    const read = computerAction.parse({ action: "setting", name: "brightness" });
    const status = computerAction.parse({ action: "system_status" });
    const undo = computerAction.parse({ action: "undo" });
    expect([volume, dark, read].map(capabilityFor)).toEqual(Array(3).fill("computer_control"));
    expect(capabilityFor(status)).toBe("apps");
    expect(capabilityFor(undo)).toBe("files");
    expect([volume, dark, read, status, undo].map(describeAction)).toEqual([
      "Changing the volume",
      "Changing dark mode",
      "Checking the screen brightness",
      "Checking how the computer is doing",
      "Undoing the last file change",
    ]);
    for (const action of [volume, dark, status, undo]) {
      expect(needsConfirmation([], action)).toBe(false);
    }
    for (const bad of [
      { action: "setting", name: "wifi", on: false },
      { action: "setting", name: "volume", level: 101 },
      { action: "setting", name: "volume", level: -1 },
      { action: "setting", name: "volume", level: "loud" },
      { action: "setting" },
    ]) {
      expect(computerAction.safeParse(bad).success).toBe(false);
    }
  });
});

describe("windows and richer screen input", () => {
  it("switching needs mouse and keyboard control, closing waits for the person", async () => {
    const { computerAction, capabilityFor } = await import("../protocol");
    const { needsConfirmation } = await import("../permissions");
    const focus = computerAction.parse({ action: "window", title: "Budget.xlsx - Excel" });
    expect(focus).toMatchObject({ state: "focus" });
    expect(capabilityFor(focus)).toBe("computer_control");
    expect(capabilityFor(computerAction.parse({ action: "window_list" }))).toBe("screen");
    expect(needsConfirmation([], focus)).toBe(false);
    const close = computerAction.parse({ action: "window", title: "x", state: "close" });
    expect(needsConfirmation([], close)).toBe(true);
    expect(
      computerAction.safeParse({ action: "screen_drag", x: 1, y: 1, toX: 5, toY: 5 }).success,
    ).toBe(false);
  });
});

describe("app controls through accessibility", () => {
  it("reading an app is seeing the screen, using a control is computer control", async () => {
    const { computerAction, capabilityFor } = await import("../protocol");
    expect(capabilityFor(computerAction.parse({ action: "ui_inspect", title: "Excel" }))).toBe(
      "screen",
    );
    const act = computerAction.parse({
      action: "ui_act",
      ref: "a12",
      observationId: "u3",
      op: "invoke",
    });
    expect(capabilityFor(act)).toBe("computer_control");
    expect(
      computerAction.safeParse({ action: "ui_act", ref: "e1", observationId: "u3", op: "invoke" })
        .success,
    ).toBe(false);
  });
});

describe("Word documents", () => {
  it("accepts structured edits and refuses unknown styles or ragged tables", async () => {
    const { computerAction, capabilityFor } = await import("../protocol");
    const edit = computerAction.parse({
      action: "doc_edit",
      path: "report.docx",
      ops: [
        { op: "replace", find: "DRAFT", with: "Final" },
        { op: "append", text: "Results", style: "Heading 1" },
        { op: "table", rows: [["a", "b"]] },
      ],
    });
    expect(capabilityFor(edit)).toBe("files");
    for (const bad of [
      { op: "append", text: "x", style: "Evil" },
      { op: "macro", code: "x" },
      { op: "replace", find: "", with: "x" },
    ]) {
      expect(
        computerAction.safeParse({ action: "doc_edit", path: "a.docx", ops: [bad] }).success,
      ).toBe(false);
    }
  });
});

describe("which computer does the work", () => {
  const pc = (id: string, caps: Record<string, boolean>) => ({
    id,
    name: id,
    kind: "agent",
    capabilities: caps,
  });
  const own = { capability: "browser_real", allowed: true, device_id: null };

  it("works on a phone only when the person chose it, or when it is the only device", async () => {
    const { chooseTaskDevice } = await import("../permissions");
    const phone = { id: "Phone", name: "Pixel", kind: "android", capabilities: { apps: true } };
    const desk = pc("Desk", { browser_isolated: true });
    expect(chooseTaskDevice([desk, phone], [], "computer")).toMatchObject({
      ok: true,
      device: desk,
    });
    expect(chooseTaskDevice([desk, phone], [], "computer", "Phone")).toMatchObject({
      ok: true,
      device: phone,
    });
    expect(chooseTaskDevice([phone], [], "computer")).toMatchObject({ ok: true, device: phone });
  });

  it("works where the person is, unless they name their computer", async () => {
    const { chooseTaskDevice } = await import("../permissions");
    const phone = { id: "Phone", name: "Pixel", kind: "android", capabilities: { apps: true } };
    const desk = pc("Desk", { browser_isolated: true });
    const fromPhone = { here: "Phone" };
    // "Open Chrome" from the phone: the phone's Chrome.
    expect(chooseTaskDevice([desk, phone], [], "computer", undefined, fromPhone)).toMatchObject({
      ok: true,
      device: phone,
    });
    // "…on my PC": the computer, from the same conversation.
    expect(
      chooseTaskDevice([desk, phone], [], "computer", undefined, { ...fromPhone, on: "computer" }),
    ).toMatchObject({ ok: true, device: desk });
    expect(
      chooseTaskDevice([phone], [], "computer", undefined, { ...fromPhone, on: "computer" }),
    ).toMatchObject({ ok: false, message: expect.stringContaining("computer is not online") });
    // Web work needs a browser JARVIS drives: still the computer's.
    expect(chooseTaskDevice([desk, phone], [], "browser", undefined, fromPhone)).toMatchObject({
      ok: true,
      device: desk,
    });
    // A phone that is not online, or not the person's, is no default.
    expect(chooseTaskDevice([desk], [], "computer", undefined, fromPhone)).toMatchObject({
      ok: true,
      device: desk,
    });
  });

  it("asks when several computers could do it, and never guesses", async () => {
    const { chooseTaskDevice } = await import("../permissions");
    const two = [pc("Laptop", { browser_isolated: true }), pc("Desk", { browser_isolated: true })];
    expect(chooseTaskDevice(two, [], "computer")).toMatchObject({ ok: false });
    expect(chooseTaskDevice(two, [], "browser")).toMatchObject({ ok: false });
    expect(chooseTaskDevice(two, [], "browser", "Desk")).toMatchObject({
      ok: true,
      device: { id: "Desk" },
    });
  });

  it("uses the one computer allowed to use the person's own browser", async () => {
    const { chooseTaskDevice } = await import("../permissions");
    const devices = [
      pc("Laptop", { browser_isolated: true }),
      pc("Desk", { browser_isolated: true, browser_real: true }),
    ];
    expect(chooseTaskDevice(devices, [own], "browser")).toMatchObject({
      ok: true,
      device: { id: "Desk" },
      real: true,
    });
    expect(chooseTaskDevice(devices, [own], "computer")).toMatchObject({ ok: false });
  });

  it("says plainly when the chosen computer is offline or none is connected", async () => {
    const { chooseTaskDevice } = await import("../permissions");
    expect(chooseTaskDevice([pc("Laptop", {})], [], "computer", "Gone")).toMatchObject({
      ok: false,
      message: expect.stringContaining("not online"),
    });
    expect(chooseTaskDevice([], [], "computer")).toMatchObject({ ok: false });
  });
});

describe("app names (audit C07)", () => {
  it("accepts an app named in any script and refuses control or direction characters", () => {
    const open = (name: string) => computerAction.safeParse({ action: "open_app", name }).success;
    for (const name of [
      "Visual Studio Code",
      "हिन्दी नोट्स",
      "日本語エディタ",
      "O’Reilly Reader",
    ]) {
      expect(open(name), name).toBe(true);
    }
    for (const name of ["", "evil‮exe.txt", "bell\u0007", "zero​width", "x".repeat(81)]) {
      expect(open(name), JSON.stringify(name)).toBe(false);
    }
  });
});

describe("a phone without app control (P13)", () => {
  it("is told how to turn it on, where a computer is only told it is unavailable", async () => {
    const { refuseAction } = await import("../permissions");
    const rows = [
      { capability: "screen", allowed: true, device_id: null },
      { capability: "computer_control", allowed: true, device_id: null },
    ];
    const offered = { apps: true, screen: false, computer_control: false, accessibility: false };
    const action = { action: "ui_inspect" } as never;
    const phone = refuseAction(rows, {
      deviceId: "d",
      mode: "isolated",
      action,
      offered,
      phone: true,
    });
    expect(phone?.message).toMatch(/Android's Accessibility settings/);
    const computer = refuseAction(rows, { deviceId: "d", mode: "isolated", action, offered });
    expect(computer?.message).toMatch(/not available on this device/);
  });
});
