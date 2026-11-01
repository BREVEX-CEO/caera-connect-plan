-- No row content leaves the runner: deterministic counts and SHA-256 hashes only.
SET search_path TO public, extensions;
SELECT format($query$
  SELECT %L, count(*), encode(extensions.digest(
    coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), ''),
    'sha256'), 'hex')
  FROM %I.%I AS t;
$query$, n.nspname || '.' || c.relname, n.nspname, c.relname)
FROM pg_class AS c JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname IN ('public', 'auth', 'storage')
ORDER BY n.nspname, c.relname
\gexec

SELECT schemaname, sequencename, coalesce(last_value::text, 'NULL'), increment_by, cycle
FROM pg_sequences
WHERE schemaname IN ('public', 'auth', 'storage')
ORDER BY schemaname, sequencename;
