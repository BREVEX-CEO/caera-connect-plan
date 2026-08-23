"""
EVERY REPLY CARRIES THE ID OF THE REQUEST THAT ASKED FOR IT.

The shared client in src/lib/native/native-host-client.node.ts matches replies
to requests by ``id``. It used to match them by POSITION, which held only while
the queue and the reply stream stayed in step — and one timeout was enough to
break it: the waiter was dropped when its deadline passed, the host answered a
moment later anyway, and that late reply went to the NEXT request. From then on
every answer belonged to the previous question.

On a channel that drives a real mouse and keyboard, the answer that goes astray
is the VERIFY step of observe → act → observe → verify. So this echo is not
bookkeeping: without it an agent can be told an unrelated command's check
succeeded.

The refusal cases matter as much as the successes. A caller that can correlate
replies but not errors has to start guessing at exactly the moment it can least
afford to.
"""

from __future__ import annotations

import io
import json

from ocade_host.protocol import PROTOCOL_VERSION, Refusal, serve


def _run(requests: list[dict]) -> list[dict]:
    def ok_handler(request):
        return {"command": request.command, "runId": request.run_id}

    def refusing_handler(_request):
        raise Refusal("Refused on purpose.", "blocked")

    def exploding_handler(_request):
        raise ValueError("something unexpected")

    stream_in = io.StringIO("".join(json.dumps(r) + "\n" for r in requests))
    stream_out = io.StringIO()
    serve(
        {"ok.one": ok_handler, "refuse.one": refusing_handler, "explode.one": exploding_handler},
        stream_in,
        stream_out,
    )
    return [json.loads(line) for line in stream_out.getvalue().splitlines() if line.strip()]


def _request(command: str, request_id: str | None = "r1", **extra) -> dict:
    body = {"version": PROTOCOL_VERSION, "command": command, "runId": "run-a", "payload": {}}
    if request_id is not None:
        body["id"] = request_id
    body.update(extra)
    return body


class TestRequestCorrelation:
    def test_a_successful_reply_echoes_the_request_id(self):
        [reply] = _run([_request("ok.one", "abc-1")])
        assert reply["ok"] is True
        assert reply["id"] == "abc-1"

    def test_a_refusal_echoes_the_request_id(self):
        [reply] = _run([_request("refuse.one", "abc-2")])
        assert reply["ok"] is False
        assert reply["code"] == "blocked"
        assert reply["id"] == "abc-2"

    def test_an_unexpected_error_echoes_the_request_id(self):
        [reply] = _run([_request("explode.one", "abc-3")])
        assert reply["ok"] is False
        assert reply["id"] == "abc-3"

    def test_an_unknown_command_echoes_the_request_id(self):
        [reply] = _run([_request("no.such.command", "abc-4")])
        assert reply["ok"] is False
        assert reply["code"] == "unsupported"
        assert reply["id"] == "abc-4"

    def test_a_malformed_request_still_gets_its_id_back(self):
        # Readable JSON carrying an id, but the wrong protocol version. The id
        # is recoverable, so the caller must not be left guessing.
        body = {"version": PROTOCOL_VERSION + 99, "command": "ok.one", "id": "abc-5"}
        [reply] = _run([body])
        assert reply["ok"] is False
        assert reply["id"] == "abc-5"

    def test_every_reply_in_a_batch_carries_its_own_id(self):
        replies = _run(
            [
                _request("ok.one", "one"),
                _request("refuse.one", "two"),
                _request("ok.one", "three"),
            ]
        )
        assert [r["id"] for r in replies] == ["one", "two", "three"]

    def test_the_id_is_not_the_run_id(self):
        # A run id names an agent RUN and is shared by every request in it, so
        # matching on it would not distinguish two commands in the same run.
        replies = _run([_request("ok.one", "id-1"), _request("ok.one", "id-2")])
        assert [r["id"] for r in replies] == ["id-1", "id-2"]
        assert {r["data"]["runId"] for r in replies} == {"run-a"}

    def test_a_request_without_an_id_still_gets_exactly_one_reply(self):
        # Older callers send no id. They must keep working; they simply get no
        # correlation field back, and the client drops rather than misdelivers.
        [reply] = _run([_request("ok.one", request_id=None)])
        assert reply["ok"] is True
        assert "id" not in reply

    def test_an_integer_id_is_accepted_and_echoed_as_text(self):
        [reply] = _run([_request("ok.one", request_id=None, id=7)])
        assert reply["id"] == "7"
