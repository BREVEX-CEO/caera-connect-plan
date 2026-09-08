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
    expect([...scoped].sort()).toEqual([
      "deeper",
      "deepest",
      "has_role",
      "has_tenant_role",
      "helper",
      "is_tenant_member",
      "mutation",
    ]);
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
