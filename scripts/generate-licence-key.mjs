#!/usr/bin/env node
/**
 * Generate the licence signing key, and mint signed licences with it.
 *
 * WHY THIS EXISTS RATHER THAN "run minisign". `minisign` is a separate binary
 * most people do not have installed, and telling somebody to go and find one
 * before their product can check a licence is how a release step gets skipped.
 * Everything here uses Node's own Ed25519, and emits the exact minisign format
 * the Rust verifier reads.
 *
 * KEY CUSTODY, STATED PLAINLY. The SECRET key is the company's most valuable
 * file: anyone holding it can mint licences. It is written to disk with no
 * copy printed to the terminal, so it does not end up in scrollback, a CI log,
 * or a transcript. Keep it offline. Back it up somewhere that is not the machine
 * you build on. If it leaks, every licence ever issued becomes forgeable and the
 * only remedy is a new key and a new build.
 *
 * Only the PUBLIC half is compiled into the product, via
 * OCADE_LICENCE_PUBLIC_KEY.
 *
 * Usage:
 *   node scripts/generate-licence-key.mjs keygen
 *   node scripts/generate-licence-key.mjs sign --key ocade-licence.key \
 *        --licensee "Acme Ltd" --reference ORD-1024 [--hardware <id>] [--days 365]
 */

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign as edSign,
} from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

/*
 * MINISIGN WIRE FORMAT.
 *
 * Public key blob:  "Ed" | key_id(8) | public_key(32)          = 42 bytes
 * Signature blob:   "ED" | key_id(8) | signature(64)           = 74 bytes
 *
 * "ED" (uppercase D) means PREHASHED: what gets signed is the BLAKE2b-512 of the
 * message, not the message. The Rust side calls `verify(.., allow_legacy=false)`,
 * which accepts only this form -- so signing the raw bytes here would produce a
 * signature that is valid Ed25519 and still rejected. That mismatch is silent
 * and looks exactly like a corrupted licence, which is why it is spelled out.
 */
const ALG_PREHASHED = Buffer.from("ED", "ascii");
const ALG_PUBLIC = Buffer.from("Ed", "ascii");

function rawPublicKey(publicKey) {
  // SPKI for Ed25519 is a 12-byte header followed by the 32-byte key.
  return publicKey.export({ type: "spki", format: "der" }).subarray(12);
}

function encodePublicKey(keyId, publicKey) {
  return Buffer.concat([ALG_PUBLIC, keyId, rawPublicKey(publicKey)]).toString("base64");
}

function signDocument(privateKey, keyId, document, trustedComment) {
  // Prehash, then sign the hash. See the format note above.
  const digest = createHash("blake2b512").update(document).digest();
  const signature = edSign(null, digest, privateKey);

  // The global signature covers the signature AND the trusted comment, so the
  // comment cannot be edited after the fact.
  const global = edSign(
    null,
    Buffer.concat([signature, Buffer.from(trustedComment, "utf8")]),
    privateKey,
  );

  return [
    "untrusted comment: signature from OCADE licence key",
    Buffer.concat([ALG_PREHASHED, keyId, signature]).toString("base64"),
    `trusted comment: ${trustedComment}`,
    global.toString("base64"),
    "",
  ].join("\n");
}

const [command] = process.argv.slice(2);

function flag(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

if (command === "keygen") {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const keyId = randomBytes(8);

  const publicPath = flag("out", "ocade-licence.pub");
  const secretPath = flag("secret", "ocade-licence.key");

  const encodedPublic = encodePublicKey(keyId, publicKey);

  writeFileSync(
    publicPath,
    `untrusted comment: OCADE licence public key\n${encodedPublic}\n`,
    "utf8",
  );

  writeFileSync(
    secretPath,
    JSON.stringify(
      {
        keyId: keyId.toString("base64"),
        privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }),
      },
      null,
      2,
    ),
    // Owner-only where the platform honours it.
    { encoding: "utf8", mode: 0o600 },
  );

  console.log(`Secret key written to ${secretPath} -- keep it offline, never commit it.`);
  console.log(`Public key written to ${publicPath}\n`);
  console.log("Set this when building a release:\n");
  console.log(`  OCADE_LICENCE_PUBLIC_KEY=${encodedPublic}\n`);
  // The secret is deliberately NOT printed. See the key-custody note.
  process.exit(0);
}

if (command === "sign") {
  const secretPath = flag("key", "ocade-licence.key");
  const stored = JSON.parse(readFileSync(secretPath, "utf8"));
  const privateKey = createPrivateKey(stored.privateKeyPem);
  const keyId = Buffer.from(stored.keyId, "base64");

  const days = Number(flag("days", "0"));
  const licence = {
    licensee: flag("licensee", "Unnamed"),
    reference: flag("reference", "none"),
    hardware_id: flag("hardware", null),
    expires_at: days > 0 ? Math.floor(Date.now() / 1000) + days * 86400 : null,
  };

  const document = Buffer.from(JSON.stringify(licence), "utf8");
  const signature = signDocument(
    privateKey,
    keyId,
    document,
    `OCADE licence for ${licence.licensee}`,
  );

  const base = flag("out", "ocade-licence");
  writeFileSync(`${base}.json`, document);
  writeFileSync(`${base}.json.minisig`, signature, "utf8");

  console.log(`Licence written to ${base}.json and ${base}.json.minisig`);
  console.log(`Public key for this secret: ${encodePublicKey(keyId, createPublicKey(privateKey))}`);
  process.exit(0);
}

console.error("usage: generate-licence-key.mjs <keygen|sign> [options]");
console.error("       see the header of this file for the full option list");
process.exit(2);
