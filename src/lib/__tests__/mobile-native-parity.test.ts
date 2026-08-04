import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Android / iOS native plug-in parity.
 *
 * The mobile mission-control bridge is implemented TWICE — once in Java, once
 * in Swift — against one shared JavaScript surface. Nothing in the build makes
 * them agree.
 *
 * The existing integration gate checks only that both files exist and that the
 * string `acknowledged: false` appears somewhere in each. That would still pass
 * if `emergencyStop` existed on Android and was missing on iOS: the app would
 * offer an emergency stop that silently does nothing on one platform. These
 * tests compare the METHOD SETS and require every mutating method to be
 * fail-closed on BOTH platforms.
 *
 * HONEST LIMIT: this is source parity. Neither plug-in is compiled or executed
 * here — that needs the Android SDK/JDK and macOS/Xcode with real devices, which
 * remain external prerequisites. No runtime behaviour is claimed.
 */

const ANDROID = "android/app/src/main/java/com/caeracadane/ocade/OcadeMobilePlugin.java";
const IOS = "ios/App/App/OcadeMobilePlugin.swift";
const SHELL = "mobile/www/index.html";

const android = readFileSync(ANDROID, "utf8");
const ios = readFileSync(IOS, "utf8");
const shell = readFileSync(SHELL, "utf8");

/** Methods Android exposes to JavaScript, via @PluginMethod. */
const androidMethods = [...android.matchAll(/@PluginMethod\s+public\s+void\s+(\w+)\s*\(/g)]
  .map((m) => m[1])
  .sort();

/** Methods iOS DECLARES in its bridged method table. */
const iosDeclared = [...ios.matchAll(/CAPPluginMethod\(name:\s*"(\w+)"/g)].map((m) => m[1]).sort();

/** Methods iOS actually IMPLEMENTS. */
const iosImplemented = [...ios.matchAll(/@objc\s+func\s+(\w+)\s*\(/g)].map((m) => m[1]).sort();

describe("method extraction is not vacuous", () => {
  it("found methods on both platforms", () => {
    expect(androidMethods.length).toBeGreaterThan(3);
    expect(iosDeclared.length).toBeGreaterThan(3);
    expect(iosImplemented.length).toBeGreaterThan(3);
  });
});

describe("the two native plug-ins expose the same surface", () => {
  it("Android and iOS expose exactly the same method set", () => {
    expect(androidMethods).toEqual(iosDeclared);
  });

  it("iOS implements every method it declares — no declared-but-missing method", () => {
    // A declared method with no implementation crashes or silently no-ops when
    // JavaScript calls it.
    expect(iosImplemented).toEqual(iosDeclared);
  });

  it("neither platform exposes a method the other lacks", () => {
    const onlyAndroid = androidMethods.filter((m) => !iosDeclared.includes(m));
    const onlyIos = iosDeclared.filter((m) => !androidMethods.includes(m));
    expect({ onlyAndroid, onlyIos }).toEqual({ onlyAndroid: [], onlyIos: [] });
  });

  it("uses the same JavaScript plug-in name on both platforms", () => {
    expect(android).toMatch(/@CapacitorPlugin\(name\s*=\s*"OcadeMobile"\)/);
    expect(ios).toMatch(/jsName\s*=\s*"OcadeMobile"/);
  });
});

describe("every mutating method is fail-closed on BOTH platforms", () => {
  // Until an authenticated relay exists, these must never report success.
  const mutating = ["pair", "issueScopedCommand", "emergencyStop"];

  it("declares all the mutating methods on both platforms", () => {
    for (const method of mutating) {
      expect(androidMethods, `android missing ${method}`).toContain(method);
      expect(iosDeclared, `ios missing ${method}`).toContain(method);
    }
  });

  it("Android refuses rather than acknowledging", () => {
    expect(android).toMatch(/result\.put\("acknowledged",\s*false\)/);
    expect(android).toMatch(/result\.put\("outcome",\s*"refused"\)/);
  });

  it("iOS refuses rather than acknowledging", () => {
    expect(ios).toMatch(/"acknowledged":\s*false/);
    expect(ios).toMatch(/"outcome":\s*"refused"/);
  });

  it("routes every mutating method through the shared refusal helper", () => {
    // Each must call resolveUnavailable rather than hand-rolling a response that
    // might accidentally report success.
    for (const method of mutating) {
      const androidBody =
        new RegExp(`public void ${method}\\(PluginCall call\\) \\{([\\s\\S]*?)\\n    \\}`).exec(
          android,
        )?.[1] ?? "";
      expect(androidBody, `android ${method}`).toMatch(/resolveUnavailable\(/);

      const iosBody =
        new RegExp(
          `@objc func ${method}\\(_ call: CAPPluginCall\\) \\{([\\s\\S]*?)\\n    \\}`,
        ).exec(ios)?.[1] ?? "";
      expect(iosBody, `ios ${method}`).toMatch(/resolveUnavailable\(/);
    }
  });

  it("neither platform ever resolves acknowledged:true", () => {
    expect(android).not.toMatch(/"acknowledged",\s*true/);
    expect(ios).not.toMatch(/"acknowledged":\s*true/);
  });

  it("reports pairing and transport as NOT connected", () => {
    expect(android).toMatch(/result\.put\("paired",\s*false\)/);
    expect(android).toMatch(/result\.put\("transportConnected",\s*false\)/);
    expect(ios).toMatch(/"paired":\s*false/);
    expect(ios).toMatch(/"transportConnected":\s*false/);
  });

  it("reports the mission snapshot as unverified", () => {
    expect(android).toMatch(/result\.put\("verified",\s*false\)/);
    expect(ios).toMatch(/"verified":\s*false/);
  });

  it("uses the same user-facing refusal wording on both platforms", () => {
    const message = "The authenticated mobile relay is not connected.";
    expect(android).toContain(message);
    expect(ios).toContain(message);
  });
});

describe("the web shell only calls methods that exist natively", () => {
  it("uses the declared native seam", () => {
    expect(shell).toMatch(/Capacitor\?\.Plugins\?\.OcadeMobile/);
  });

  it("calls no method that is missing from either platform", () => {
    const called = [...shell.matchAll(/native\.(\w+)\s*\(/g)].map((m) => m[1]);
    const unknown = [...new Set(called)].filter((m) => !androidMethods.includes(m));
    expect(unknown, `shell calls native methods that do not exist: ${unknown.join(", ")}`).toEqual(
      [],
    );
  });
});
