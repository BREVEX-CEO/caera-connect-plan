import { describe, expect, it } from "vitest";
import { consoleHostRedirect, consoleOrigin, isConsoleHost, isConsolePath } from "../console-host";

const asset = (pathname: string) =>
  /^\/(assets|fonts|brand)\/|^\/(sw\.js|favicon\.ico)$/.test(pathname);
const route = (href: string) => consoleHostRedirect(new URL(href), asset);

describe("the console's own origin", () => {
  it("is admin. in front of the site's host, locally too", () => {
    expect(consoleOrigin(new URL("https://ocade.in/admin"))).toBe("https://admin.ocade.in");
    expect(consoleOrigin(new URL("http://localhost:8788/admin"))).toBe(
      "http://admin.localhost:8788",
    );
    expect(consoleOrigin(new URL("http://127.0.0.1:8788/admin"))).toBe(
      "http://admin.localhost:8788",
    );
    expect(isConsoleHost("admin.ocade.in")).toBe(true);
    expect(isConsoleHost("ocade.in")).toBe(false);
  });

  it("serves the console, its way in, its code prompt and server calls", () => {
    for (const path of [
      "/admin",
      "/admin/",
      "/auth/console",
      "/auth/challenge",
      "/_serverFn/abc",
    ]) {
      expect(isConsolePath(path), path).toBe(true);
      expect(route(`https://admin.ocade.in${path}`), path).toBeNull();
    }
    expect(route("https://admin.ocade.in/assets/app-1.js")).toBeNull();
  });

  it("sends everything else to the same address on the site", () => {
    for (const path of [
      "/library?x=1",
      "/auth",
      "/auth/callback?code=1",
      "/ocade-jarvis",
      "/administrator",
      "/sw.js",
    ]) {
      const response = route(`https://admin.ocade.in${path}`)!;
      expect(response.status, path).toBe(308);
      expect(response.headers.get("location"), path).toBe(`https://ocade.in${path}`);
    }
    expect(route("http://admin.localhost:8788/auth?next=%2Fadmin")!.headers.get("location")).toBe(
      "http://localhost:8788/auth?next=%2Fadmin",
    );
  });

  it("opens the console at its root", () => {
    const response = route("https://admin.ocade.in/")!;
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/admin");
  });

  it("leaves the site alone", () => {
    for (const href of [
      "https://ocade.in/",
      "https://ocade.in/admin",
      "http://127.0.0.1:8788/library",
    ]) {
      expect(route(href), href).toBeNull();
    }
  });
});
