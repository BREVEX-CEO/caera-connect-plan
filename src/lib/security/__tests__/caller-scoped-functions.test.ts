import { describe, expect, it } from "vitest";
import { callerScopedFunctions } from "../caller-scoped-functions";

/**
 * The fixpoint itself, tested on the shapes it must get right.
 *
 * Two security gates depend on this answer, so a wrong "yes" here would make
 * both of them pass on a function that reaches anybody's rows. The cases below
 * are the ones that decide it: indirection must be followed, and a near-miss on
 * a name must not be followed.
 */
describe("which functions bind their caller", () => {
  it("recognises a function that names auth.uid() itself", () => {
    const scoped = callerScopedFunctions(
      new Map([["direct", "select 1 from t where user_id = auth.uid()"]]),
    );
    expect(scoped.has("direct")).toBe(true);
  });

  it("follows a call into a helper that does, however deep", () => {
    const scoped = callerScopedFunctions(
      new Map([
        ["helper", "select role from members where user_id = auth.uid()"],
        ["mutation", "begin if not helper() then raise; end if; end"],
        ["deeper", "select mutation()"],
        ["deepest", "select deeper()"],
      ]),
    );
    expect([...scoped].sort()).toEqual(["deeper", "deepest", "has_role", "helper", "mutation"]);
  });

  it("leaves a function that binds nobody unscoped", () => {
    const scoped = callerScopedFunctions(
      new Map([
        ["helper", "select 1 where user_id = auth.uid()"],
        ["unscoped", "delete from t where id = p_id"],
      ]),
    );
    expect(scoped.has("unscoped")).toBe(false);
  });

  /**
   * THE CASE A SUBSTRING MATCH WOULD GET WRONG. `helper_other` contains
   * `helper`, and calling it proves nothing about the caller.
   */
  it("does not treat a longer name containing a scoped one as a call to it", () => {
    const scoped = callerScopedFunctions(
      new Map([
        ["helper", "select 1 where user_id = auth.uid()"],
        ["near_miss", "select helper_other()"],
      ]),
    );
    expect(scoped.has("near_miss")).toBe(false);
  });

  it("counts the role oracles, which read the caller by another path", () => {
    const scoped = callerScopedFunctions(new Map([["gated", "select has_role(p_user, 'admin')"]]));
    expect(scoped.has("gated")).toBe(true);
  });

  it("tolerates whitespace inside auth . uid ( )", () => {
    const scoped = callerScopedFunctions(new Map([["spaced", "select auth . uid ( )"]]));
    expect(scoped.has("spaced")).toBe(true);
  });
});

describe("a helper in another schema", () => {
  /*
   * Authorization in this schema is resolved through `private` helpers, and
   * both gates now hand those bodies in alongside the public ones. The point of
   * doing so is that the ANSWER follows the helper rather than the schema it
   * lives in: a private helper that binds the caller scopes everything above
   * it, and one that does not, does not.
   */
  it("scopes a public function that authorizes through a caller-bound private helper", () => {
    const scoped = callerScopedFunctions(
      new Map([
        [
          "ocade_is_support_admin",
          "SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = (SELECT auth.uid()))",
        ],
        [
          "ocade_admin_seat_overview",
          "BEGIN IF NOT private.ocade_is_support_admin() THEN RAISE; END IF; END",
        ],
      ]),
    );
    expect(scoped.has("ocade_admin_seat_overview")).toBe(true);
  });

  it("does not scope one whose private helper never asks who is calling", () => {
    const scoped = callerScopedFunctions(
      new Map([
        ["some_private_helper", "SELECT true"],
        ["reads_anything", "BEGIN IF NOT private.some_private_helper() THEN RAISE; END IF; END"],
      ]),
    );
    expect(scoped.has("reads_anything")).toBe(false);
  });
});
