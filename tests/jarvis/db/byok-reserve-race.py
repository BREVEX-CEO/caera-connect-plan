"""Concurrent agents cannot overspend one customer key's budget (plan 14D.4A.5, 14D.4A.8).

Twelve separate database sessions reserve a 0.3 USD call on one connection at the same moment,
against a 1.0 USD daily amount: exactly three may succeed, whatever the interleaving. Runs only in
run.sh's disposable database; the fixture is removed afterwards.
"""

from __future__ import annotations

import subprocess
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor


def main(database: str) -> None:
    command = [
        "psql",
        "-q",
        "-X",
        "-A",
        "-t",
        "-v",
        "ON_ERROR_STOP=1",
        "-d",
        database,
        "-c",
    ]

    def sql(statement: str) -> str:
        result = subprocess.run(
            command + [statement],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        if result.returncode:
            raise AssertionError(result.stderr.strip())
        return result.stdout.strip()

    user = str(uuid.uuid4())
    sql(f"INSERT INTO auth.users (id, email) VALUES ('{user}', 'race@example.test')")
    try:
        connection = sql(
            "SET ROLE service_role; SELECT public.ocade_byok_save("
            f"'{user}', NULL, 'Race', 'openai', 'https://api.example/v1', 'vendor/paid', 'sk-race-secret-0000')"
        ).splitlines()[-1]
        sql(
            "SET ROLE service_role;"
            f"SELECT public.ocade_byok_models_save('{user}', '{connection}', "
            '\'[{"model": "vendor/paid", "inputPrice": 100000, "outputPrice": 200000}]\');'
            f"SELECT public.ocade_byok_policy('{user}', '{connection}', 'manual', 'custom', false, "
            "'USD', 'UTC', NULL, 1.0, NULL);"
        )
        # 1 input and 1 output token: 0.1 + 0.2 = 0.3 USD a call.
        reserve = (
            "SET ROLE service_role; SELECT coalesce(refusal, 'reserved') FROM public.ocade_byok_reserve("
            f"'{user}', '{connection}', 'vendor/paid', 'none', 1, 1)"
        )
        with ThreadPoolExecutor(max_workers=12) as pool:
            answers = [
                line.splitlines()[-1]
                for line in pool.map(lambda _: sql(reserve), range(12))
            ]
        reserved = answers.count("reserved")
        refused = answers.count("budget_day")
        total = sql(
            f"SELECT sum(reserved) FROM public.byok_spend WHERE connection_id = '{connection}'"
        )
        assert (reserved, refused) == (3, 9), answers
        assert float(total) <= 1.0, total
        print(
            "PASS concurrent reservations stay within one key's budget (3 of 12 reserved)"
        )
    finally:
        sql(f"DELETE FROM auth.users WHERE id = '{user}'")


if __name__ == "__main__":
    main(sys.argv[1])
