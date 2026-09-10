/**
 * PASSING NULL TO A SQL PARAMETER THE TYPE GENERATOR CALLS NON-NULLABLE.
 *
 * `src/integrations/supabase/types.ts` is generated, and the generator reads
 * only two facts about a function parameter: its type, and whether it has a
 * DEFAULT. A parameter with a default becomes optional (`p_expires_at?: string`)
 * and one without becomes required and non-nullable (`p_deep_link: string`) —
 * even though Postgres accepts NULL for both. Postgres has no "NOT NULL"
 * parameter, so the generator cannot express what these functions actually
 * take.
 *
 * That leaves three cases, and only the third needs this file:
 *
 *   1. The parameter has a DEFAULT NULL. Pass `undefined` and let the parameter
 *      be omitted; Postgres applies the default. No cast, no helper.
 *   2. NULL is not meaningful. Pass the real value.
 *   3. The parameter has NO default and NULL is MEANINGFUL — an unlimited weekly
 *      allowance, a notification with no deep link. There is nothing to omit and
 *      no substitute value: an empty string is a link to nowhere, and zero is an
 *      allowance of nothing. This is the case, and it is why a cast is the
 *      honest answer rather than a workaround.
 *
 * Use it ONLY for case 3, and only where NULL is what the function documents.
 * It is deliberately not generic over the whole call: it launders one argument,
 * at the call site, where a reader can see which parameter and why.
 */
export function sqlNullable<T>(value: T | null | undefined): T {
  return (value ?? null) as T;
}
