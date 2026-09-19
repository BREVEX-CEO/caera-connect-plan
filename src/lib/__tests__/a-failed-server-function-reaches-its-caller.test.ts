import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * A SERVER FUNCTION THAT FAILS MUST REJECT, AND FOR MONTHS NONE OF THEM DID.
 *
 * The handlers signalled failure by throwing a `Response`:
 *
 *     if (error) throw new Response(error.message, { status: 500 });
 *
 * The browser received the 500 — it is in the server log — and the client half
 * of the call RESOLVED anyway, with `{}`. Proved in a browser: a message
 * deletion the database refused returned `{}`, the screen removed the turn, and
 * a reload brought the private text back because it had never left the account.
 *
 * Nothing above it could have noticed. Every `try`/`catch` around a server
 * function, every rollback, every "could not be read, try again" state was
 * unreachable code — including the ones written specifically so a failure would
 * be visible. One line in each handler turned the whole product's error
 * handling off.
 *
 * `throw new Error(message)` is serialized by the framework and rethrown on the
 * client, which is what every caller was already written for. The status code
 * was never visible to those callers, so nothing is lost with it.
 *
 * This is a source check on purpose: the defect is a shape, it is invisible at
 * runtime unless a database refuses something, and it is one autocomplete away
 * from returning.
 */
const HANDLERS = globSync("src/**/*.functions.ts").map((file) => file.replaceAll("\\", "/"));

describe("server functions", () => {
  it("has handlers to check", () => {
    expect(HANDLERS.length).toBeGreaterThan(5);
  });

  it("never signals failure with a thrown Response, which the client resolves", () => {
    const offenders = HANDLERS.filter((file) =>
      /throw\s+new\s+Response\s*\(/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("throws an Error instead, which the client rethrows", () => {
    // At least one handler must still report failure at all: a file where every
    // `throw` was deleted would pass the check above for the wrong reason.
    const reporting = HANDLERS.filter((file) =>
      /throw\s+new\s+Error\s*\(/.test(readFileSync(file, "utf8")),
    );
    expect(reporting.length).toBeGreaterThan(0);
  });
});
