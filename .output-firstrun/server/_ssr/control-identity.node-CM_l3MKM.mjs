import { t as createClient } from "../_libs/supabase__supabase-js.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/control-identity.node-CM_l3MKM.js
/**
* Verifying a bearer token, without becoming a second authentication system.
*
* `requireSupabaseAuth` is a middleware: it either lets a call through or
* throws. That is exactly right for every handler that requires an account, and
* exactly wrong for the Control + Work gate, which needs to ASK whether a token
* is valid and then decide — because a caller with no token at all may still be
* the person sitting at this keyboard (see `control-access.node.ts`).
*
* So this asks Supabase the same question the middleware asks, with the same
* key material and the same claim requirement, and returns an answer instead of
* throwing. It grants nothing on its own: a `true` here still has to pass
* through the gate above before any tool runs.
*
* DELIBERATELY NOT A CACHE. Verifying costs one network call per mission start,
* not per action, and a cached "this token was fine a minute ago" is how a
* revoked session keeps working.
*/
async function verifyBearerToken(token) {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_PUBLISHABLE_KEY;
	if (!url || !key) return {
		ok: false,
		reason: "This installation has no account service configured."
	};
	if (!token || token.split(".").length !== 3) return {
		ok: false,
		reason: "That sign-in token is not valid."
	};
	try {
		const { data, error } = await createClient(url, key, {
			global: { headers: { Authorization: `Bearer ${token}` } },
			auth: {
				storage: void 0,
				persistSession: false,
				autoRefreshToken: false
			}
		}).auth.getClaims(token);
		if (error || !data?.claims?.sub) return {
			ok: false,
			reason: "That sign-in has expired. Sign in again to continue."
		};
		return {
			ok: true,
			userId: String(data.claims.sub)
		};
	} catch {
		return {
			ok: false,
			reason: "OCADE could not check that sign-in."
		};
	}
}
//#endregion
export { verifyBearerToken };
