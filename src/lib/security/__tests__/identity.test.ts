import { describe, expect, it } from "vitest";
import {
  canUnlink,
  describeIdentityError,
  listIdentities,
  requestEmailChange,
  unlinkProvider,
  type LinkedIdentity,
} from "@/lib/security/identity";

function fakeSupabase(
  options: {
    identities?: {
      id: string;
      identity_id?: string;
      provider: string;
      identity_data?: Record<string, unknown>;
      created_at?: string;
    }[];
    updateError?: { message: string };
    unlinkError?: { message: string };
  } = {},
) {
  const calls: { name: string; args?: unknown }[] = [];
  const auth = {
    async getUserIdentities() {
      calls.push({ name: "getUserIdentities" });
      return { data: { identities: options.identities ?? [] }, error: null };
    },
    async updateUser(args: unknown) {
      calls.push({ name: "updateUser", args });
      return { data: null, error: options.updateError ?? null };
    },
    async unlinkIdentity(args: unknown) {
      calls.push({ name: "unlinkIdentity", args });
      return { data: null, error: options.unlinkError ?? null };
    },
  };
  return { client: { auth }, calls };
}

const identity = (over: Partial<LinkedIdentity> = {}): LinkedIdentity => ({
  id: "identity-1",
  provider: "email",
  label: "person@example.com",
  linkedAt: null,
  ...over,
});

describe("removing the last way in is refused", () => {
  it("REFUSES to unlink the only identity when there is no password", () => {
    /*
     * THE FAILURE THAT CANNOT BE UNDONE. Unlinking the last identity leaves an
     * account whose rows and data are all still there and which nobody can ever
     * reach again. Supabase refuses to remove the final identity, but it knows
     * nothing about OCADE's password credential, so the question it can answer
     * is not the question that matters: does ANY way in survive?
     */
    const only = identity();
    const decision = canUnlink([only], only, false);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toMatch(/only way into this account/i);
  });

  it("allows it when a password would still get them in", () => {
    const only = identity();
    expect(canUnlink([only], only, true).allowed).toBe(true);
  });

  it("allows it when another provider would still get them in", () => {
    const google = identity({ id: "identity-2", provider: "google" });
    expect(canUnlink([identity(), google], google, false).allowed).toBe(true);
  });

  it("explains rather than offering a control that always fails", () => {
    const only = identity();
    const decision = canUnlink([only], only, false);
    if (!decision.allowed) {
      expect(decision.reason.length).toBeGreaterThan(40);
      // Says what to do, not only what is refused.
      expect(decision.reason).toMatch(/set a password|link another/i);
    }
  });
});

describe("changing an email verifies before it replaces the login", () => {
  it("asks Supabase to send a confirmation, and reports the address as PENDING", async () => {
    /*
     * `updateUser({ email })` does not change the login — it sends a
     * confirmation, and the address becomes authoritative only when the link is
     * followed. Reporting it as changed is how somebody deletes the old mailbox
     * and locks themselves out.
     */
    const fake = fakeSupabase();
    const result = await requestEmailChange("New.Person@Example.com ", fake.client);
    expect(result.pending).toBe("new.person@example.com");
    expect(fake.calls[0]).toEqual({
      name: "updateUser",
      args: { email: "new.person@example.com" },
    });
  });

  it("refuses something that is not an address, before calling Supabase", async () => {
    const fake = fakeSupabase();
    for (const bad of ["", "   ", "not-an-email", "a@b", "a b@c.com"]) {
      await expect(requestEmailChange(bad, fake.client)).rejects.toThrow(/email address/i);
    }
    expect(fake.calls).toEqual([]);
  });

  it("does not report success when the request failed", async () => {
    const fake = fakeSupabase({ updateError: { message: "email address already registered" } });
    await expect(requestEmailChange("taken@example.com", fake.client)).rejects.toThrow(
      /already.*linked to an account|already/i,
    );
  });
});

describe("unlinking resolves the identity from the server", () => {
  it("passes Supabase the identity IT knows about, not one rebuilt on screen", async () => {
    /*
     * A stale page could otherwise send an identity id that no longer means
     * what it did. Unlinking is not an action to take against a guess.
     */
    const fake = fakeSupabase({
      identities: [
        { id: "raw-1", identity_id: "identity-1", provider: "google", created_at: "2026-01-01" },
      ],
    });
    await unlinkProvider("identity-1", fake.client);
    expect(fake.calls.map((call) => call.name)).toEqual(["getUserIdentities", "unlinkIdentity"]);
    expect(fake.calls[1]!.args).toMatchObject({ identity_id: "identity-1", provider: "google" });
  });

  it("refuses an identity the account no longer has", async () => {
    const fake = fakeSupabase({ identities: [] });
    await expect(unlinkProvider("identity-1", fake.client)).rejects.toThrow(/no longer/i);
    expect(fake.calls.map((call) => call.name)).not.toContain("unlinkIdentity");
  });
});

describe("reading the sign-in methods", () => {
  it("labels each by the address the provider knows", async () => {
    const fake = fakeSupabase({
      identities: [
        {
          id: "raw-1",
          identity_id: "identity-1",
          provider: "google",
          identity_data: { email: "person@gmail.com" },
        },
      ],
    });
    const listed = await listIdentities(fake.client);
    expect(listed[0]).toMatchObject({ provider: "google", label: "person@gmail.com" });
  });

  it("survives a provider that gives no label", async () => {
    const fake = fakeSupabase({ identities: [{ id: "raw-1", provider: "apple" }] });
    const listed = await listIdentities(fake.client);
    expect(listed[0]!.label).toBeNull();
    expect(listed[0]!.id).toBe("raw-1");
  });
});

describe("what the person is told when it fails", () => {
  it("names the fix for an address already in use", () => {
    expect(describeIdentityError({ message: "email address already registered" })).toMatch(
      /sign out and sign in with it/i,
    );
  });

  it("passes an unrecognised message through rather than inventing one", () => {
    expect(describeIdentityError({ message: "something new" })).toBe("something new");
  });

  it("never returns an empty sentence", () => {
    for (const error of [null, {}, { message: "" }]) {
      expect(describeIdentityError(error as never).length).toBeGreaterThan(10);
    }
  });
});
