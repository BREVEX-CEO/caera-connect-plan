/**
 * THE PUBLIC STATUS FEED, FETCHED FROM THE RUNNING PRODUCT.
 *
 * The unit tests prove the snapshot and the Atom serialisation are correct from
 * a set of observations. They cannot prove the endpoint is reachable, that it
 * runs the real probes, that it refuses to be cached, or that what comes back
 * over the wire parses — and a status feed that a monitor cannot read is worse
 * than none, because the monitor reports silence rather than an outage.
 *
 * So this asks the built application for both formats and checks what arrives.
 */

const BASE = process.env.OCADE_BASE_URL ?? "http://127.0.0.1:8080";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const jsonResponse = await fetch(`${BASE}/api/public/status`, {
  headers: { accept: "application/json" },
});
check("the status feed answers", jsonResponse.ok, `HTTP ${jsonResponse.status}`);
check(
  "the status feed refuses to be cached",
  /no-store/.test(jsonResponse.headers.get("cache-control") ?? ""),
  jsonResponse.headers.get("cache-control") ?? "(no cache-control)",
);
check(
  "the status feed is readable by an outside monitor",
  jsonResponse.headers.get("access-control-allow-origin") === "*",
  jsonResponse.headers.get("access-control-allow-origin") ?? "(none)",
);

let snapshot = null;
try {
  snapshot = await jsonResponse.json();
  check("the status feed is valid JSON", true);
} catch (error) {
  check("the status feed is valid JSON", false, String(error).slice(0, 120));
}

if (snapshot) {
  check(
    "it reports on every component in the catalogue",
    Array.isArray(snapshot.components) && snapshot.components.length >= 4,
    `${snapshot.components?.length ?? 0} components`,
  );
  check(
    "it states that it is not an independent status service",
    snapshot.independent === false &&
      /not an independent status service/i.test(snapshot.independenceStatement ?? ""),
    String(snapshot.independent),
  );
  check(
    "an empty incident list carries the reason it is empty",
    Array.isArray(snapshot.incidents) &&
      snapshot.incidents.length === 0 &&
      /not a claim that there have been no incidents/i.test(snapshot.incidentsNote ?? ""),
    snapshot.incidentsNote ?? "(no note)",
  );
  /*
   * THE PROBES REALLY RAN. A snapshot of rows all reading "unknown" would
   * satisfy every check above while measuring nothing — the exact failure the
   * page this replaced had. At least one component must carry a real HTTP
   * observation.
   */
  const measured = (snapshot.components ?? []).filter((component) =>
    /responded \d{3}|could not be reached/.test(component.detail ?? ""),
  );
  check(
    "at least one component was actually probed over HTTP",
    measured.length > 0,
    measured.map((component) => `${component.id}: ${component.detail}`).join("; ") || "none",
  );
  check(
    "the public web surface is operational in the built app",
    snapshot.components?.find((component) => component.id === "public-web")?.state ===
      "operational",
    snapshot.components?.find((component) => component.id === "public-web")?.detail ?? "(missing)",
  );
  /*
   * A device check has no browser here, and saying so is the point: the server
   * must not invent an answer about somebody's hardware.
   */
  check(
    "a device-specific check reports that it was not run here",
    snapshot.components?.find((component) => component.deviceSpecific)?.state === "unknown",
    snapshot.components?.find((component) => component.deviceSpecific)?.detail ?? "(missing)",
  );
  const serialised = JSON.stringify(snapshot);
  check(
    "the feed carries no credential-shaped value",
    !/(sb_secret_|service_role|eyJhbGciOi|-----BEGIN)/.test(serialised),
    "",
  );
}

const atomResponse = await fetch(`${BASE}/api/public/status?format=atom`);
const atom = await atomResponse.text();
check("the Atom feed answers", atomResponse.ok, `HTTP ${atomResponse.status}`);
check(
  "the Atom feed is served as Atom",
  /application\/atom\+xml/.test(atomResponse.headers.get("content-type") ?? ""),
  atomResponse.headers.get("content-type") ?? "(none)",
);
check(
  "the Atom feed is well-formed enough to parse",
  atom.startsWith("<?xml") && atom.includes("<feed") && atom.trimEnd().endsWith("</feed>"),
  atom.slice(0, 60),
);
check(
  "every Atom entry carries a stable id and an updated time",
  (atom.match(/<entry>/g) ?? []).length === (atom.match(/<id>urn:ocade:status:/g) ?? []).length &&
    (atom.match(/<entry>/g) ?? []).length === (atom.match(/<updated>/g) ?? []).length - 1,
  `${(atom.match(/<entry>/g) ?? []).length} entries`,
);
check(
  "the Atom feed leaves no raw angle bracket in text content",
  !/<summary type="text">[^<]*<(?!\/summary)/.test(atom),
  "",
);

const head = await fetch(`${BASE}/api/public/status`, { method: "HEAD" });
check(
  "a monitor can check reachability without paying for the probes",
  head.ok,
  `HTTP ${head.status}`,
);

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} status-feed checks passed`);
process.exitCode = failed.length ? 1 : 0;
