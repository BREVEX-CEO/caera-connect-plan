/**
 * The CSP forbids eval, so zod's compiled fast path can never run here. Zod probes for eval
 * with `Function("")` when each object schema is built, which Firefox reports as a CSP
 * violation on every page. Imported first by the router and start entries, this sets zod's
 * shared configuration before any schema exists (the same object `z.config` writes to).
 */
const shared = globalThis as { __zod_globalConfig?: Record<string, unknown> };
Object.assign((shared.__zod_globalConfig ??= {}), { jitless: true });
