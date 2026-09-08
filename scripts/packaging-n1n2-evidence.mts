/**
 * N1 (updater-key half) + N2 (installer half): a real installer, built and
 * signed with a real key, and the signature verified independently.
 *
 * TWO DIFFERENT KEYS LIVE IN N1, AND I HAD CONFLATED THEM
 * ------------------------------------------------------
 * `tauri.conf.json` carries two distinct placeholders:
 *
 *   bundle.windows.certificateThumbprint  — an Authenticode CODE-SIGNING
 *       certificate. Identifies the publisher to Windows. Must be issued by a
 *       certificate authority; cannot be conjured locally. STILL MISSING.
 *
 *   plugins.updater.pubkey                — the UPDATE signing key. A minisign
 *       (Ed25519) keypair generated locally with `tauri signer generate`. Needs
 *       no authority, no purchase and no credentials.
 *
 * I had been reporting both as "blocked on a certificate". Only the first is.
 * The second was always doable, and is now done: the placeholder
 * REPLACE_WITH_SIGNING_PUBLIC_KEY is gone, replaced with a real generated key,
 * and a real installer is signed with its private half.
 *
 * The private key is NOT in this repository and never will be — it lives under
 * the local application data directory, exactly like the browser-extension
 * signing key.
 *
 * VERIFICATION IS DONE HERE, NOT DELEGATED TO THE TOOL THAT PRODUCED IT
 * --------------------------------------------------------------------
 * `tauri signer sign` reporting success only means it wrote a file. This parses
 * the minisign structures itself, checks the signature's key id against the key
 * id in the configured public key, and verifies the Ed25519 signature over the
 * installer's actual bytes — then flips one byte and requires the verification
 * to fail. A signature check that cannot fail is not a check.
 *
 * Usage: npx vite-node scripts/packaging-n1n2-evidence.mts -- [--write]
 */
import { createHash, createPublicKey, verify as edVerify } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const write = process.argv.includes("--write");
const OUT = "release/OCADE_N1_N2_INSTALLER_SIGNING.json";
const BUNDLE = "native/companion/tauri/target/release/bundle";
const MSI = join(BUNDLE, "msi", "OCADE Native Companion_0.1.0_x64_en-US.msi");
const NSIS = join(BUNDLE, "nsis", "OCADE Native Companion_0.1.0_x64-setup.exe");
const SIG = `${NSIS}.sig`;

/** minisign: line 2 is base64 of [alg 2][keyId 8][payload]. */
function decodeMinisign(text: string) {
  const lines = text.trim().split("\n");
  const comment = lines[0];
  const body = Buffer.from(lines[1].trim(), "base64");
  return {
    comment,
    algorithm: body.subarray(0, 2).toString("ascii"),
    keyId: body.subarray(2, 10).toString("hex"),
    payload: body.subarray(10),
  };
}

let failed = false;

// The configured public key is read from tauri.conf.json — the value the
// product would actually ship with, not a copy kept beside the test.
const conf = JSON.parse(readFileSync("native/companion/tauri/tauri.conf.json", "utf8"));
const configuredPubkeyB64 = conf.plugins.updater.pubkey as string;
const placeholderGone = !configuredPubkeyB64.includes("REPLACE_WITH");
if (!placeholderGone) failed = true;

const pub = decodeMinisign(Buffer.from(configuredPubkeyB64, "base64").toString("utf8"));
const sigFile = decodeMinisign(readFileSync(SIG, "utf8"));

// The signature must come from the key the product is configured to trust.
const keyIdsMatch = pub.keyId === sigFile.keyId;
if (!keyIdsMatch) failed = true;

/** Wrap a raw Ed25519 public key in the SPKI prefix node's verify expects. */
function ed25519Spki(raw: Buffer) {
  return createPublicKey({
    key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), raw]),
    format: "der",
    type: "spki",
  });
}

const installerBytes = readFileSync(NSIS);
/*
 * minisign signs the file bytes for algorithm "Ed", and a BLAKE2b-512 digest
 * for "ED" (prehashed). Tauri uses the prehashed form. Both are handled so the
 * check is against what the format actually specifies rather than an assumption.
 */
const signedMessage =
  sigFile.algorithm === "ED"
    ? createHash("blake2b512").update(installerBytes).digest()
    : installerBytes;

const key = ed25519Spki(pub.payload);
const signatureValid = edVerify(null, signedMessage, key, sigFile.payload);
if (!signatureValid) failed = true;

// TAMPER CONTROL: change one byte and the same check must fail.
const tampered = Buffer.from(installerBytes);
tampered[Math.floor(tampered.length / 2)] ^= 0xff;
const tamperedMessage =
  sigFile.algorithm === "ED" ? createHash("blake2b512").update(tampered).digest() : tampered;
const tamperedRejected = !edVerify(null, tamperedMessage, key, sigFile.payload);
if (!tamperedRejected) failed = true;

/*
 * Windows' own view of whether these binaries carry an Authenticode signature.
 *
 * Deliberately one simple invocation per file. A first version built a single
 * PowerShell command with nested quoting around $_ and $(...) and produced an
 * unterminated string, so PowerShell sat waiting for more input and the whole
 * script hung with no output at all — indistinguishable from a slow build.
 * `-NonInteractive` makes that failure mode impossible rather than unlikely.
 */
const authenticodeStatus = (file: string) =>
  execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `(Get-AuthenticodeSignature -LiteralPath ${JSON.stringify(file.replace(/\//g, "\\"))}).Status`,
    ],
    { encoding: "utf8" },
  ).trim();

const authenticode = [
  { file: "msi", status: authenticodeStatus(MSI) },
  { file: "nsis", status: authenticodeStatus(NSIS) },
];

const doc = {
  schemaVersion: 1,
  item: "N1 (updater-key half) + N2 (Windows installer half)",
  generatedAt: new Date().toISOString(),
  verdict: failed ? "FAILED" : "PROVEN",
  updaterSigningKey: {
    placeholderReplaced: placeholderGone,
    previousValue: "REPLACE_WITH_SIGNING_PUBLIC_KEY",
    configuredPublicKeyComment: pub.comment,
    keyId: pub.keyId,
    algorithm: pub.algorithm,
    privateKeyLocation:
      "%LOCALAPPDATA%\\OCADE\\ocade-updater.key — outside the repository, never committed",
    note: "This is the UPDATE signing key (minisign/Ed25519, generated by `tauri signer generate`). It needs no certificate authority and no purchase, which is why it could be done here. It is NOT the Authenticode publisher certificate.",
  },
  signature: {
    file: SIG,
    signatureComment: sigFile.comment,
    signatureKeyId: sigFile.keyId,
    algorithm: sigFile.algorithm,
    keyIdMatchesConfiguredKey: keyIdsMatch,
    verifiedOverInstallerBytes: signatureValid,
    tamperedInstallerRejected: tamperedRejected,
    note: "Verified here rather than trusted from the signing tool's own success message. One byte of the installer is then flipped and the same verification must fail — a signature check that cannot fail is not a check.",
  },
  installers: {
    msi: {
      path: MSI,
      sha256: createHash("sha256").update(readFileSync(MSI)).digest("hex"),
      bytes: readFileSync(MSI).length,
    },
    nsis: {
      path: NSIS,
      sha256: createHash("sha256").update(installerBytes).digest("hex"),
      bytes: installerBytes.length,
    },
    note: "Built by `tauri build` from the real Rust sources. Verification of the MSI is recorded separately in the N2 evidence: an administrative install (msiexec /a /qn) opened and parsed the package and extracted PFiles\\OCADE Native Companion\\caera-companion.exe, exit code 0, without installing or registering anything.",
  },
  authenticodeStatus: {
    windowsReport: authenticode,
    note: "NotSigned is the correct and expected result. Authenticode requires a CA-issued code-signing certificate, and the certificate store on this machine contains zero. N1's OS-verification clause remains genuinely blocked; nothing here is presented as satisfying it.",
  },
  stillNotClaimed: [
    "Authenticode code-signing of the Windows build, and OS verification of that signature — needs a purchased or cloud-service certificate.",
    "macOS build, signing and notarization — needs an Apple Developer account and a macOS host.",
    "A deployed update server — needs Cloudflare credentials. The manifest logic itself is proven in release/OCADE_N2_UPDATE_SERVER.json.",
  ],
};

console.log(`updater key      : placeholder replaced = ${placeholderGone}`);
console.log(`                   ${pub.comment}  (keyId ${pub.keyId}, alg ${pub.algorithm})`);
console.log(`signature        : keyId ${sigFile.keyId} matches configured key = ${keyIdsMatch}`);
console.log(`                   verifies over installer bytes = ${signatureValid}`);
console.log(`                   tampered installer rejected   = ${tamperedRejected}`);
console.log(
  `installers       : msi ${doc.installers.msi.bytes} bytes, nsis ${doc.installers.nsis.bytes} bytes`,
);
console.log(`authenticode     : ${JSON.stringify(authenticode)}`);
console.log(`N1(updater)+N2(installer): ${doc.verdict}`);

if (write) {
  writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}
process.exitCode = failed ? 1 : 0;
