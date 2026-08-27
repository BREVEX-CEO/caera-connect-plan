/**
 * Reading a model's arguments the way it meant them.
 *
 * Ported from the archive's `semanticBoolean.ts` and `semanticNumber.ts`.
 *
 * THE FAILURE THESE EXIST FOR
 * ---------------------------
 * Tool arguments arrive as model-generated JSON, and a model quoting a value
 * is not a rare event -- `"allowOcr": "false"`, `"limit": "30"`. The naive
 * reads are all wrong in the same direction:
 *
 *     args.allowOcr !== false     // "false" is not false -> OCR stays ON
 *     args.wait === true          // "true" is not true    -> never waits
 *     Number(args.limit)          // "" becomes 0, null becomes 0
 *
 * Every one of those turns the model's instruction into its opposite, silently,
 * with no error anywhere.
 *
 * ADAPTED, AND WHY
 * ----------------
 * The donor expressed these as zod preprocessors, because its tools were zod
 * schemas. OCADE's registry uses a small JSON-schema subset, so they are plain
 * functions applied at the tool boundary. The RULES are the donor's and are the
 * part that matters: only the exact string literals are converted, and anything
 * else is left alone to be rejected by the caller rather than coerced into a
 * value nobody meant.
 */

const NUMERIC = /^-?\d+(\.\d+)?$/

/**
 * `"true"` and `"false"` become booleans. Nothing else is touched.
 *
 * Deliberately NOT JavaScript truthiness: `Boolean("false")` is `true`, which
 * is the bug this replaces rather than a shortcut to it.
 */
export function semanticBoolean(value: unknown): unknown {
  if (value === 'true') return true
  if (value === 'false') return false
  return value
}

/**
 * A quoted decimal becomes a number. An empty string, null, or `"abc"` does
 * not: those are not numbers a person wrote, and converting them would hide a
 * malformed call behind a plausible zero.
 */
export function semanticNumber(value: unknown): unknown {
  if (typeof value === 'string' && NUMERIC.test(value)) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return value
}

/** The declared shape of one argument, from the tool registry's schema. */
export type DeclaredType = string | undefined

/**
 * Coerce one value according to what its tool SAYS the argument is.
 *
 * Schema-driven on purpose. A blanket sweep would convert a search term that
 * happens to be the word "false" into a boolean, which is a different bug in
 * the same family. Only an argument the tool declares as a boolean or a number
 * is touched at all.
 */
export function coerceDeclared(value: unknown, declared: DeclaredType): unknown {
  if (declared === 'boolean') return semanticBoolean(value)
  if (declared === 'number' || declared === 'integer') return semanticNumber(value)
  return value
}

/**
 * Coerce a whole argument object against a map of declared types.
 *
 * Returns the same object when nothing changed, so a caller can tell a
 * coerced call from an untouched one without comparing field by field.
 */
export function coerceArguments(
  args: Record<string, unknown>,
  declaredTypes: Record<string, DeclaredType>,
): Record<string, unknown> {
  let changed = false
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    const next = coerceDeclared(value, declaredTypes[key])
    if (next !== value) changed = true
    out[key] = next
  }
  return changed ? out : args
}
