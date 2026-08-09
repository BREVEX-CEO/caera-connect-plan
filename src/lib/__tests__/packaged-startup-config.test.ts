import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("packaged Tauri startup configuration", () => {
  it("does not pass map-shaped config to unit-config plugins", () => {
    const config = JSON.parse(readFileSync("native/companion/tauri/tauri.conf.json", "utf8")) as {
      plugins?: Record<string, unknown>;
    };

    // tauri-plugin-clipboard-manager and tauri-plugin-global-shortcut deserialize
    // their config as unit. Supplying { all: false } compiled and packaged but
    // panicked before the desktop process could start.
    expect(config.plugins).not.toHaveProperty("clipboard-manager");
    expect(config.plugins).not.toHaveProperty("global-shortcut");
  });
});
