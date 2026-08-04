/**
 * N2 (update-server half): a real HTTP update server returning a real, signed
 * version manifest, verified with real cryptography.
 *
 * WHAT THIS DOES AND DOES NOT CLAIM
 * --------------------------------
 * It does NOT claim a deployed production update server — that needs Cloudflare
 * credentials this session does not have. The server here is a real HTTP server
 * bound to loopback, queried over a real socket at the exact endpoint shape the
 * Tauri updater is configured to use:
 *
 *   /companion/{target}/{arch}/{current_version}
 *
 * It does NOT claim a code-signing certificate. As src/lib/packaging/update-signature.ts
 * puts it, a release certificate identifies the PUBLISHER, which is a separate
 * concern from whether the signing and verification pipeline works. That pipeline
 * is proven here with a generated Ed25519 key pair, so the day a real key exists
 * the only new variable is the key.
 *
 * The artifact is real: a file on disk, hashed with SHA-256, and the signature
 * is a real Ed25519 signature over that digest — the same primitive the Tauri
 * updater uses.
 *
 * EVERY REFUSAL PATH IS EXERCISED, because a verifier that only ever says yes
 * is indistinguishable from no verifier at all. A tampered artifact, a
 * signature from the wrong key, an unsigned manifest, a hashless manifest and a
 * downgrade must each be refused by name.
 *
 * Usage: npx vite-node scripts/packaging-n2-evidence.mts -- [--write]
 */
import { createServer } from "node:http";
import { createHash, webcrypto } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { planUpdate, type UpdateManifest } from "../src/lib/packaging/update-plan.ts";
import { verifyUpdateSignature } from "../src/lib/packaging/update-signature.ts";

const write = process.argv.includes("--write");
const OUT = "release/OCADE_N2_UPDATE_SERVER.json";
const PORT = 8791;
const CURRENT = "0.1.0";
const NEXT = "0.2.0";

const b64 = (b: ArrayBuffer | Uint8Array) => Buffer.from(b as ArrayBuffer).toString("base64");

// ---- a real artifact on disk, really hashed
const work = join(tmpdir(), "ocade-n2");
mkdirSync(work, { recursive: true });
const artifactPath = join(work, `ocade-companion-${NEXT}.bin`);
const artifactBytes = Buffer.from(
  `OCADE companion ${NEXT}\nbuilt-for: test update manifest\n${"payload-".repeat(512)}`,
);
writeFileSync(artifactPath, artifactBytes);
const artifactSha256 = createHash("sha256").update(artifactBytes).digest("hex");

// ---- a real Ed25519 key pair and a real signature over the digest
const keyPair = (await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, [
  "sign",
  "verify",
])) as CryptoKeyPair;
const publicKeyBase64 = b64(await webcrypto.subtle.exportKey("raw", keyPair.publicKey));
const message = new TextEncoder().encode(artifactSha256);
const signatureBase64 = b64(await webcrypto.subtle.sign({ name: "Ed25519" }, keyPair.privateKey, message));

// A second, unrelated key: used to prove a signature from the wrong key fails.
const otherPair = (await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, [
  "sign",
  "verify",
])) as CryptoKeyPair;
const wrongSignatureBase64 = b64(
  await webcrypto.subtle.sign({ name: "Ed25519" }, otherPair.privateKey, message),
);

const manifest: UpdateManifest = {
  version: NEXT,
  signature: signatureBase64,
  sha256: artifactSha256,
  url: `http://127.0.0.1:${PORT}/download/ocade-companion-${NEXT}.bin`,
  signingKeyId: "ocade-test-ed25519-1",
  signedAt: Date.now(),
  notes: "Test manifest served by the N2 evidence server.",
};

// ---- the real HTTP server, at the endpoint shape the updater is configured for
const requests: Record<string, unknown>[] = [];
const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const parts = url.pathname.split("/").filter(Boolean);
  requests.push({ method: req.method, path: url.pathname });

  // /companion/{target}/{arch}/{current_version}
  if (parts[0] === "companion" && parts.length === 4) {
    const [, target, arch, clientVersion] = parts;
    if (clientVersion === NEXT) {
      // Already current: 204 is what the Tauri updater expects for "no update".
      res.writeHead(204).end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ...manifest, target, arch }, null, 2));
    return;
  }
  if (parts[0] === "download") {
    res.writeHead(200, { "content-type": "application/octet-stream" });
    res.end(artifactBytes);
    return;
  }
  res.writeHead(404).end();
});
await new Promise<void>((r) => server.listen(PORT, "127.0.0.1", () => r()));

let failed = false;

// ---- a REAL request over a real socket
const endpoint = `http://127.0.0.1:${PORT}/companion/windows-x86_64/x86_64/${CURRENT}`;
const response = await fetch(endpoint);
const served = (await response.json()) as UpdateManifest & { target: string; arch: string };
const rawResponse = JSON.stringify(served, null, 2);

// ---- the client verifies it exactly as the product would
const signatureVerdict = await verifyUpdateSignature({
  publicKeyBase64,
  signatureBase64: served.signature ?? "",
  artifactSha256: served.sha256 ?? "",
});
const decision = planUpdate(served, { currentVersion: CURRENT });

// The served hash must match the bytes actually downloadable from the server.
const downloaded = Buffer.from(await (await fetch(served.url!)).arrayBuffer());
const downloadedSha = createHash("sha256").update(downloaded).digest("hex");
const hashMatchesDownload = downloadedSha === served.sha256;

const manifestCorrect =
  response.status === 200 &&
  served.version === NEXT &&
  signatureVerdict.ok === true &&
  decision.action === "apply" &&
  hashMatchesDownload;
if (!manifestCorrect) failed = true;

// ---- "already current" must be a 204, not an update offered to itself
const currentResponse = await fetch(
  `http://127.0.0.1:${PORT}/companion/windows-x86_64/x86_64/${NEXT}`,
);
const noUpdateWhenCurrent = currentResponse.status === 204;
if (!noUpdateWhenCurrent) failed = true;

// ---- refusal paths, each of which must fail BY NAME
const refusals = [
  {
    case: "artifact tampered after signing",
    verdict: await verifyUpdateSignature({
      publicKeyBase64,
      signatureBase64,
      artifactSha256: createHash("sha256").update(Buffer.concat([artifactBytes, Buffer.from("x")])).digest("hex"),
    }),
  },
  {
    case: "signature from a different key",
    verdict: await verifyUpdateSignature({
      publicKeyBase64,
      signatureBase64: wrongSignatureBase64,
      artifactSha256,
    }),
  },
  {
    case: "malformed signature",
    verdict: await verifyUpdateSignature({
      publicKeyBase64,
      signatureBase64: "not-base64-!!",
      artifactSha256,
    }),
  },
].map((r) => ({ case: r.case, refused: r.verdict.ok !== true, verdict: r.verdict }));

const planRefusals = [
  { case: "unsigned manifest", decision: planUpdate({ ...manifest, signature: null }, { currentVersion: CURRENT }) },
  { case: "manifest with no hash", decision: planUpdate({ ...manifest, sha256: null }, { currentVersion: CURRENT }) },
  { case: "downgrade offered", decision: planUpdate({ ...manifest, version: "0.0.9" }, { currentVersion: CURRENT }) },
  {
    case: "below the upgrade floor",
    decision: planUpdate({ ...manifest, minimumClientVersion: "0.5.0" }, { currentVersion: CURRENT }),
  },
].map((r) => ({ case: r.case, refusedOrSkipped: r.decision.action !== "apply", decision: r.decision }));

const allRefusalsHeld =
  refusals.every((r) => r.refused) && planRefusals.every((r) => r.refusedOrSkipped);
if (!allRefusalsHeld) failed = true;

server.close();

const doc = {
  schemaVersion: 1,
  item: "N2 (update-server half) - real HTTP request returning a correct, signed version manifest",
  generatedAt: new Date().toISOString(),
  verdict: failed ? "FAILED" : "PROVEN",
  notClaimed: [
    "A DEPLOYED update server. This is a real HTTP server on loopback, not a production deployment — that needs Cloudflare credentials this session does not have.",
    "A code-signing certificate. The key pair here is generated. As update-signature.ts says, a release certificate identifies the publisher, which is a separate concern from whether the signing pipeline works.",
    "Windows and macOS installers opening correctly — the other half of N2, untouched here.",
  ],
  endpointShape: "/companion/{target}/{arch}/{current_version} — the exact path the Tauri updater is configured to call",
  request: { method: "GET", url: endpoint, status: response.status },
  rawManifestResponse: rawResponse,
  verification: {
    signature: signatureVerdict,
    plan: decision,
    servedSha256: served.sha256,
    downloadedSha256: downloadedSha,
    hashMatchesDownloadedBytes: hashMatchesDownload,
    note: "The manifest's hash is checked against the bytes actually downloaded from the server, so a manifest advertising a hash it does not serve would fail here.",
  },
  alreadyCurrent: { status: currentResponse.status, correct: noUpdateWhenCurrent, note: "204 No Content is what the updater expects when no update applies." },
  refusalPaths: { signature: refusals, policy: planRefusals, allHeld: allRefusalsHeld },
  serverRequestLog: requests,
};

console.log(`GET ${endpoint}`);
console.log(`HTTP ${response.status}`);
console.log(rawResponse);
console.log(`\nsignature verify : ${JSON.stringify(signatureVerdict)}`);
console.log(`update decision  : ${JSON.stringify(decision)}`);
console.log(`hash matches download: ${hashMatchesDownload} (${downloadedSha.slice(0, 16)}…)`);
console.log(`already-current  : HTTP ${currentResponse.status} (expected 204) -> ${noUpdateWhenCurrent}`);
console.log(`refusals:`);
for (const r of refusals) console.log(`   ${r.refused ? "REFUSED" : "ACCEPTED"}  ${r.case}`);
for (const r of planRefusals) console.log(`   ${r.refusedOrSkipped ? "REFUSED" : "ACCEPTED"}  ${r.case} -> ${JSON.stringify(r.decision)}`);
console.log(`N2 (update server): ${doc.verdict}`);

if (write) {
  writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}
process.exitCode = failed ? 1 : 0;
