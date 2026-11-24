"""Replayed and raced generation permits cannot spend more than the allowance (O-11, QUOTA-08).

What a tampered browser can do is send the same request many times at once, or many different
requests at once. Twelve separate database sessions:

1. acquire one permit under the SAME idempotency key at the same moment: exactly one permit row,
   every answer names it, and the allowance is charged once;
2. finalize that permit at the same moment: it is charged once, never twice;
3. acquire under twelve DIFFERENT keys at the same moment against a 1.00 allowance at 0.30 each:
   exactly three are granted, whatever the interleaving.

Runs only in run.sh's disposable database; the fixture is removed afterwards.
"""

from __future__ import annotations

import subprocess
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor


def main(database: str) -> None:
    command = ["psql", "-q", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-d", database, "-c"]

    def sql(statement: str) -> str:
        result = subprocess.run(command + [statement], capture_output=True, text=True, timeout=30, check=False)
        if result.returncode:
            raise AssertionError(result.stderr.strip())
        return result.stdout.strip()

    def acquire(user: str, key: str, limit: int = 100) -> str:
        return sql(
            "SET ROLE service_role; SELECT outcome || ':' || coalesce(permit_id::text, '-') "
            f"FROM public.ocade_acquire_generation_permit('{user}', '{key}', 'gen-{key}', 'chat', "
            f"'pro', {limit}, NULL, 30)"
        ).splitlines()[-1]

    def run12(task) -> list[str]:
        with ThreadPoolExecutor(max_workers=12) as pool:
            return list(pool.map(task, range(12)))

    user = str(uuid.uuid4())
    sql(f"INSERT INTO auth.users (id, email) VALUES ('{user}', 'permit-race@example.test')")
    try:
        if not sql(f"SELECT 1 FROM public.profiles WHERE id = '{user}'"):
            sql(f"INSERT INTO public.profiles (id) VALUES ('{user}')")
        # 1. One key, twelve at once.
        same = run12(lambda _: acquire(user, "replayed"))
        permits = {answer.split(":", 1)[1] for answer in same}
        assert all(answer.startswith("granted:") for answer in same), same
        assert len(permits) == 1, same
        rows = sql(f"SELECT count(*) FROM public.ocade_generation_permits WHERE user_id = '{user}'")
        assert rows == "1", rows
        used = sql(f"SELECT coalesce(sum(used_hundredths), 0) FROM public.ocade_commercial_usage WHERE user_id = '{user}'")
        assert used == "30", f"replays charged {used} hundredths, want 30"
        # 2. Finalize twelve at once: charged once.
        settled = run12(lambda _: sql(
            "SET ROLE service_role; SELECT outcome FROM public.ocade_finalize_generation_permit("
            f"'{user}', 'replayed', 30)").splitlines()[-1])
        assert settled == ["succeeded"] * 12, settled
        used = sql(f"SELECT coalesce(sum(used_hundredths), 0) FROM public.ocade_commercial_usage WHERE user_id = '{user}'")
        assert used == "30", f"finalize replays charged {used} hundredths, want 30"
        # 3. Twelve different keys at once against what is left (70 of 100): two more fit.
        different = run12(lambda i: acquire(user, f"distinct-{i}"))
        granted = sum(answer.startswith("granted:") for answer in different)
        assert granted == 2, different
        assert all(a.startswith(("granted:", "session_exhausted:")) for a in different), different
        print("PASS replayed and raced permits charge once and never exceed the allowance")
    finally:
        sql(f"DELETE FROM auth.users WHERE id = '{user}'")


if __name__ == "__main__":
    main(sys.argv[1])
