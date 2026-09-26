import { describe, expect, it } from "vitest";
import { browserAction, describeAction, hostOf, jarvisTools } from "../protocol";
import { isAllowed, refuseAction, siteAllowed, type PermissionRow } from "../permissions";
import { heard } from "../use-voice";

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
    expect(names).toEqual(["start_task", "browser", "finish_task"]);
    expect(jarvisTools(true).map((tool) => tool.name)).toContain("remember");
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
      refuseAction([row("master", false)], { deviceId: "d1", mode: "isolated" })?.capability,
    ).toBe("master");
  });

  it("refuses the real browser unless allowed", () => {
    expect(refuseAction([], { deviceId: "d1", mode: "real" })?.capability).toBe("browser_real");
    expect(refuseAction([row("browser_real", true)], { deviceId: "d1", mode: "real" })).toBeNull();
  });

  it("honours a turned-off site and its subdomains", () => {
    const rows = [row("site:example.com", false)];
    expect(siteAllowed(rows, "https://example.com")).toBe(false);
    expect(siteAllowed(rows, "https://shop.example.com/cart")).toBe(false);
    expect(siteAllowed(rows, "https://example.org")).toBe(true);
    expect(siteAllowed(rows, "file:///etc/passwd")).toBe(false);
    expect(
      refuseAction(rows, { deviceId: "d", mode: "isolated", url: "example.com" })?.capability,
    ).toBe("site");
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
});
