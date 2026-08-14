"""Racing the search engines instead of queueing them.

WHY SERIAL FALLBACK IS SLOW EXACTLY WHEN IT MATTERS
----------------------------------------------------
`web_search.search` tries Brave, then Bing, then DuckDuckGo, stopping at the
first that answers. That is correct and it is cheap when the first rung works.
It is worst-case terrible when it does not: a rung that TIMES OUT rather than
refusing costs its full timeout before the next one is even attempted, and
those add up in series. A rate-limited DuckDuckGo behind a slow Bing is ten
seconds of nothing, for a question whose answer was one rung away the whole
time.

Nothing about the three engines requires them to go in order. They are
independent networks answering the same question, so they run at the same time
and the FIRST GOOD ANSWER WINS. The cost of a search stops being the sum of the
failures and becomes the latency of the fastest success.

"FIRST TO RETURN" IS NOT THE SAME AS "FIRST TO RETURN SOMETHING USEFUL"
-----------------------------------------------------------------------
A racer that takes the first response full stop will happily take an empty
result list from a rate-limiter, because that arrives fastest of all -- the
error page is quicker than the real search every time. So a result has to CLEAR
A BAR before it can win: enough rows, and rows carrying actual snippet text
rather than bare links. A racer without a quality gate reliably selects for
failure, because failure is fast.

The losers are abandoned rather than waited for. They are daemon threads on a
pool that is not joined, so a straggler finishing after the answer has been
returned costs nothing and blocks nobody.
"""

from __future__ import annotations

import concurrent.futures
import threading
import time
from typing import Any

from actions.web_search import (
    OFFLINE_NOTE,
    _ENGINES,
    is_online,
)

__all__ = ["parallel_search", "race"]

#: A result must have at least this many rows to win the race. One row is what
#: a rate-limiter's "no results" page parses to, and it arrives first.
MIN_ROWS = 2

#: And at least this much snippet text across those rows. A page of bare links
#: with no descriptions is not an answer to a question.
MIN_SNIPPET_CHARS = 80

#: The whole race is abandoned after this. Every engine being slow is itself an
#: answer -- it means "tell the user you could not find out", and saying that
#: after six seconds is better than saying it after thirty.
RACE_TIMEOUT = 6.0


def _quality(rows: list[dict[str, str]]) -> int:
    """How much real information a result set carries. Higher wins."""
    if not rows:
        return 0
    snippet = sum(len((row.get("snippet") or "").strip()) for row in rows)
    return snippet + len(rows) * 10


def _good_enough(rows: list[dict[str, str]]) -> bool:
    if len(rows) < MIN_ROWS:
        return False
    return sum(len((row.get("snippet") or "").strip()) for row in rows) >= MIN_SNIPPET_CHARS


def _best_thin(finished: dict[str, Any]) -> dict[str, Any] | None:
    """The best of what arrived when nothing cleared the quality bar.

    A thin answer beats no answer. The bar exists to stop a fast empty page
    WINNING a race it should not win -- not to throw away the only result that
    came back when every engine was having a bad minute.
    """
    best: dict[str, Any] | None = None
    for name, state in finished.items():
        rows = state.get("rows") or []
        if not rows:
            continue
        score = _quality(rows)
        if best is None or score > best["score"]:
            best = {"engine": name, "rows": rows, "ms": state.get("ms", 0), "score": score}
    return best


def race(
    query: str,
    *,
    max_results: int = 5,
    timelimit: str | None = None,
    timeout: float = RACE_TIMEOUT,
) -> dict[str, Any]:
    """Run every engine at once; return the first answer that clears the bar."""
    wanted = max(1, min(int(max_results), 10))
    started = time.monotonic()
    finished: dict[str, Any] = {}
    lock = threading.Lock()
    winner: dict[str, Any] | None = None
    done = threading.Event()

    def run(name: str, engine) -> None:
        nonlocal winner
        began = time.monotonic()
        try:
            rows = engine(query, wanted, timelimit)[:wanted]
        except Exception as error:  # noqa: BLE001
            with lock:
                finished[name] = {"ok": False, "why": type(error).__name__}
            return
        elapsed = int((time.monotonic() - began) * 1000)
        with lock:
            finished[name] = {
                "ok": bool(rows),
                "count": len(rows),
                "ms": elapsed,
                "rows": rows,
            }
            if rows and _good_enough(rows) and winner is None:
                winner = {"engine": name, "rows": rows, "ms": elapsed}
                done.set()

    pool = concurrent.futures.ThreadPoolExecutor(
        max_workers=len(_ENGINES), thread_name_prefix="ocade-search"
    )
    try:
        for name, engine in _ENGINES:
            pool.submit(run, name, engine)
        done.wait(timeout=timeout)
    finally:
        # NOT joined. A loser still in flight is abandoned deliberately: waiting
        # for it would give back exactly the latency the race removes.
        pool.shutdown(wait=False, cancel_futures=True)

    with lock:
        chosen = winner or _best_thin(finished)
        tried = {name: {k: v for k, v in s.items() if k != "rows"} for name, s in finished.items()}

    total = int((time.monotonic() - started) * 1000)

    if chosen is None:
        return {
            "status": "failed",
            "query": query,
            "results": [],
            "engines": tried,
            "elapsedMs": total,
            "verified": False,
            "detail": (
                f"All {len(_ENGINES)} search engines were tried at once for “{query}” and "
                f"none returned a usable answer within {int(timeout)}s."
            ),
        }

    return {
        "status": "ok",
        "query": query,
        "engine": chosen["engine"],
        "results": chosen["rows"],
        "count": len(chosen["rows"]),
        "engines": tried,
        "winnerMs": chosen["ms"],
        "elapsedMs": total,
        "verified": True,
        "detail": (
            f"{chosen['engine']} answered “{query}” first, in {chosen['ms']} ms, with "
            f"{len(chosen['rows'])} results. {len(_ENGINES)} engines were raced."
        ),
    }


def parallel_search(
    query: str,
    *,
    max_results: int = 5,
    timelimit: str | None = None,
) -> dict[str, Any]:
    """A live answer to a real-world question, as fast as the fastest engine.

    Offline is checked FIRST and separately, exactly as the serial path does it:
    racing three engines against a dead network is three timeouts instead of
    one, and the honest answer is available without any of them.
    """
    query = " ".join((query or "").split())
    if not query:
        return {
            "status": "invalid",
            "query": "",
            "results": [],
            "verified": False,
            "detail": "There was nothing to search for.",
        }

    if not is_online():
        return {
            "status": "offline",
            "query": query,
            "results": [],
            "online": False,
            "note": OFFLINE_NOTE,
            "data": (
                "Operating offline. Real-time data unavailable. Use local knowledge, "
                f"but append this note: '{OFFLINE_NOTE}'"
            ),
            "verified": False,
            "detail": f"No network, so “{query}” was answered from local knowledge.",
        }

    return race(query, max_results=max_results, timelimit=timelimit)
