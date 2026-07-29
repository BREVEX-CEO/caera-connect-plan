import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("mobile native source truth boundary", () => {
  it("never claims an emergency stop was sent without an acknowledged native transport", () => {
    const shell = read("mobile/www/index.html");
    expect(shell).not.toContain('"Stop request sent to your computer."');
    expect(shell).toContain("OcadeMobile");
    expect(shell).toContain("acknowledged");
  });

  it("keeps Android cleartext, backup and exported-component boundaries closed", () => {
    const manifest = read("android/app/src/main/AndroidManifest.xml");
    expect(manifest).toContain('android:usesCleartextTraffic="false"');
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain('android:name="androidx.core.content.FileProvider"');
    expect(manifest).toContain('android:exported="false"');
    expect(manifest).not.toMatch(/<(service|receiver|provider)[^>]+android:exported="true"/s);
  });

  it("does not expose the whole external-storage tree through FileProvider", () => {
    const paths = read("android/app/src/main/res/xml/file_paths.xml");
    expect(paths).not.toContain("<external-path");
    expect(paths).toContain("<cache-path");
  });

  it("ships release hardening instead of an explicitly unminified Android release", () => {
    const gradle = read("android/app/build.gradle");
    expect(gradle).toContain("minifyEnabled true");
    expect(gradle).toContain("shrinkResources true");
  });

  it("exposes the complete mobile mission-control surface without phone automation", () => {
    const shell = read("mobile/www/index.html");
    const mission = read("mobile/www/mission-control.js");
    for (const label of [
      "Current PC task",
      "Application",
      "Checkpoint",
      "Send a new PC task",
      "Add or correct an instruction",
      "Approvals",
      "Outputs and receipts",
      "Pause",
      "Resume",
      "Cancel",
      "Revoke mobile session",
    ]) {
      expect(shell).toContain(label);
    }
    for (const command of [
      "task.create",
      "instruction.add",
      "instruction.correct",
      "approval.decide",
      "run.pause",
      "run.resume",
      "run.cancel",
      "emergency.stop",
      "session.revoke",
      "output.download",
    ]) {
      expect(mission).toContain(command);
    }
    expect(shell).toMatch(/never to take arbitrary control/i);
    expect(mission).not.toContain("phone.tap");
  });

  it("registers Android and iOS native bridges that fail closed without relay acknowledgement", () => {
    const android = read("android/app/src/main/java/com/caeracadane/ocade/OcadeMobilePlugin.java");
    const activity = read("android/app/src/main/java/com/caeracadane/ocade/MainActivity.java");
    const ios = read("ios/App/App/OcadeMobilePlugin.swift");
    const project = read("ios/App/App.xcodeproj/project.pbxproj");
    for (const method of [
      "pairingState",
      "pair",
      "missionSnapshot",
      "issueScopedCommand",
      "emergencyStop",
    ]) {
      expect(android).toContain(method);
      expect(ios).toContain(method);
    }
    expect(android).toContain('result.put("acknowledged", false)');
    expect(ios).toContain('"acknowledged": false');
    expect(activity).toContain("registerPlugin(OcadeMobilePlugin.class)");
    expect(project).toContain("OcadeMobilePlugin.swift in Sources");
  });
});
