import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CA8BQOW2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade-usage.functions-CJgg7s-0.js
/** Account entitlement readback. Chat inference is local and has no usage meter. */
/** The user's most recent subscription, or null when they have never had one. */
var getEntitlement = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("1d03547fcf93634f0edcf90fe58d3b374a85ffb4ce8fed857d1d642e0e6fd632"));
//#endregion
export { getEntitlement as t };
