"""Deterministic two-connection claim/receipt lock-order check in run.sh's disposable DB.

No worker or application runs. Session A holds the task; receipt session B must
wait. A then revokes the held claim while B is pending. Both must finish, and the
late receipt must replace the cancellation marker without reviving the action.
A separate STOP case exercises the pre-existing task/activity lock-order cycle.
"""

from __future__ import annotations

import json
import os
import queue
import re
import subprocess
import sys
import threading
import time
import uuid


def run_case(database: str, mode: str) -> None:
    command = ["psql", "-q", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-d", database]

    def literal(value: str) -> str:
        return "'" + value.replace("'", "''") + "'"

    def sql(statement: str, timeout: float = 10) -> str:
        result = subprocess.run(command + ["-c", statement], capture_output=True, text=True, timeout=timeout)
        if result.returncode:
            raise AssertionError(result.stderr.strip())
        return result.stdout.strip()

    user, conversation = str(uuid.uuid4()), str(uuid.uuid4())
    public_key = user.replace("-", "") * 4
    setup = """
BEGIN;
CREATE TEMP TABLE claim_race_fixture (
  user_id uuid, conversation_id uuid, device_id uuid, task_id uuid, activity_id uuid
);
INSERT INTO claim_race_fixture (user_id, conversation_id) VALUES (%s, %s);
INSERT INTO auth.users (id, email) VALUES (%s, %s);
INSERT INTO public.ocade_conversations (id, user_id, title, surface)
VALUES (%s, %s, 'Claim receipt lock fixture', 'jarvis');
GRANT ALL ON claim_race_fixture TO service_role;
SET LOCAL ROLE service_role;
DO $body$
DECLARE
  u uuid := %s;
  c uuid := %s;
  d uuid;
  t record;
  held jsonb;
BEGIN
  PERFORM public.jarvis_enroll_device(%s, 'Claim receipt fixture', 'windows', 'test', repeat('e',64));
  d := public.jarvis_approve_device(u, public.jarvis_device_code(%s));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed)
  SELECT u, d, capability, true FROM unnest(ARRAY['master','files','browser','site:race.example.test'])
    AS grants(capability);
  SELECT * INTO t FROM public.jarvis_open_task(u, c, d, 'Claim receipt fixture',
    '[{"id":"file","kind":"file_exists","description":"Fixture","params":{"path":"marker.txt"}}]', '[]');
  PERFORM public.jarvis_queue_actions(t.task_id, t.controller, '[
    {"summary":"Held browser observation","action":{"key":"held","operation":"web.open","capability":"browser","risk":"read",
      "arguments":{"url":"https://race.example.test/"},"target":{"site":"race.example.test"}}}
  ]'::jsonb);
  held := public.jarvis_claim_action(d);
  PERFORM public.jarvis_queue_actions(t.task_id, t.controller,
    '[{"summary":"Queued sibling","action":{"key":"queued","operation":"fs.list","capability":"files","risk":"read","arguments":{}}}]'::jsonb);
  UPDATE claim_race_fixture SET device_id=d, task_id=t.task_id, activity_id=(held -> 'action' ->> 'id')::uuid;
  UPDATE public.jarvis_permissions SET allowed=false
   WHERE user_id=u AND device_id=d AND capability='site:race.example.test';
END;
$body$;
COMMIT;
SELECT row_to_json(f) FROM claim_race_fixture AS f;
""" % tuple(map(literal, (user, conversation, user, user + "@example.test",
                         conversation, user, user, conversation, public_key, public_key)))
    if mode == "stop":
        setup = setup.replace(
            "  UPDATE public.jarvis_permissions SET allowed=false\n"
            "   WHERE user_id=u AND device_id=d AND capability='site:race.example.test';\n", "")
    fixture = json.loads(sql(setup))
    task, device, activity = (fixture[name] for name in ("task_id", "device_id", "activity_id"))
    nonce = uuid.uuid4().hex
    owner_env = {**os.environ, "PGAPPNAME": "ocade-claim-owner-" + nonce}
    receiver_name = "ocade-receipt-" + nonce
    receiver_env = {**os.environ, "PGAPPNAME": receiver_name}
    owner = receiver = None
    owner_out, owner_err = [], []
    readers = []
    ready = queue.Queue()

    def collect(stream, output):
        for line in stream:
            output.append(line.rstrip())
            if line.strip() == "OCADE_TASK_LOCKED":
                ready.put(True)

    try:
        owner = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE, text=True, env=owner_env)
        for stream, output in ((owner.stdout, owner_out), (owner.stderr, owner_err)):
            thread = threading.Thread(target=collect, args=(stream, output), daemon=True)
            thread.start()
            readers.append(thread)
        owner.stdin.write(
            "BEGIN; SET LOCAL ROLE service_role; SET LOCAL statement_timeout='8s'; "
            "SET LOCAL lock_timeout='6s'; SELECT id FROM public.jarvis_tasks WHERE id="
            + literal(task) + " FOR UPDATE;\n\\echo OCADE_TASK_LOCKED\n")
        owner.stdin.flush()
        try:
            ready.get(timeout=5)
        except queue.Empty:
            raise AssertionError("task-lock owner never became ready: " + "\n".join(owner_err))

        receipt = {
            "status": "observed", "maybeChanged": True,
            "observedAtUtc": "2026-11-02T00:00:00.000Z", "evidence": {"fixture": "late_receipt"},
        }
        receive = ("SET ROLE service_role; SET statement_timeout='10s'; "
                   "SELECT outcome FROM public.jarvis_submit_receipt("
                   + ",".join(map(literal, (device, activity, json.dumps(receipt)))) + "::jsonb);")
        receiver = subprocess.Popen(command + ["-c", receive], stdout=subprocess.PIPE,
                                    stderr=subprocess.PIPE, text=True, env=receiver_env)
        waiting = False
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            waiting = sql(
                "SELECT coalesce(bool_or(wait_event_type='Lock'),false) FROM pg_stat_activity "
                "WHERE application_name=" + literal(receiver_name) + " AND state='active'", timeout=2
            ) == "t"
            if waiting:
                break
            if receiver.poll() is not None:
                break
            time.sleep(0.02)
        if not waiting:
            raise AssertionError("receipt did not reach the task-lock barrier")

        operation = (
            "SELECT public.jarvis_claim_action(" + literal(device) + ");"
            if mode == "claim" else
            "SELECT to_jsonb(stopped) FROM public.jarvis_stop_task("
            + literal(user) + "," + literal(task) + ") AS stopped;"
        )
        owner.stdin.write(operation + " COMMIT;\n")
        owner.stdin.close()
        owner.wait(timeout=10)
        received, receive_error = receiver.communicate(timeout=10)
        for thread in readers:
            thread.join(timeout=2)
        if owner.returncode or receiver.returncode:
            raise AssertionError("concurrent claim/receipt failed: " +
                                 "\n".join(owner_err) + "\n" + receive_error)
        observation = json.loads(next(line for line in owner_out if line.startswith("{")))
        expected_status = "waiting" if mode == "claim" else "stopped"
        if mode == "claim":
            if observation.get("action") is not None or observation.get("task", {}).get("status") != "waiting":
                raise AssertionError("revoked held claim was returned for execution: " + json.dumps(observation))
        elif observation.get("status") != "stopped" or observation.get("in_flight") != 1:
            raise AssertionError("STOP did not fence the held action: " + json.dumps(observation))
        if received.strip() != "recorded_after_stop":
            raise AssertionError("late receipt was not retained: " + received)

        state = json.loads(sql(
            "SELECT jsonb_build_object('taskStatus',t.status,'controller',t.controller,"
            "'actionStatus',a.status,'receipt',a.result,'open',"
            "(SELECT count(*) FROM public.jarvis_activity s WHERE s.task_id=t.id "
            "AND s.status IN ('queued','claimed','needs_confirmation'))) "
            "FROM public.jarvis_tasks t JOIN public.jarvis_activity a ON a.task_id=t.id "
            "WHERE t.id=" + literal(task) + " AND a.id=" + literal(activity)))
        if (state["taskStatus"], state["controller"], state["actionStatus"], state["open"]) != (
                expected_status, None, "cancelled", 0):
            raise AssertionError("revocation fence changed during receipt race: " + json.dumps(state))
        if state["receipt"] != receipt:
            raise AssertionError("the exact late observation was lost")
        print("OCADE_TASK_RECEIPT_LOCK_ORDER:" + json.dumps({
            "operation": mode, "status": "PASS",
            "taskBarrierObserved": True, "bothConnectionsExited": True,
            "lateReceiptRecorded": True, "oldOpenActions": 0,
        }, sort_keys=True))
    finally:
        for process in (owner, receiver):
            if process is not None and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=3)
        for thread in readers:
            thread.join(timeout=2)


def main() -> None:
    if len(sys.argv) != 2 or not re.fullmatch(r"ocade_jarvis_test_[0-9]+", sys.argv[1]):
        raise SystemExit("requires run.sh's disposable ocade_jarvis_test_<pid> database")
    failed = []
    # Claim and STOP use independent committed fixtures and always run separately.
    for mode in ("claim", "stop"):
        try:
            run_case(sys.argv[1], mode)
        except Exception as error:
            detail = type(error).__name__ + ": " + str(error)
            failed.append(mode)
            print("OCADE_TASK_RECEIPT_LOCK_ORDER:" + json.dumps({
                "operation": mode, "status": "FAIL", "error": detail,
                "deadlockObserved": "deadlock detected" in detail.lower(),
            }, sort_keys=True), flush=True)
    if failed:
        raise SystemExit("FAILED task/receipt ordering: " + ", ".join(failed))


if __name__ == "__main__":
    main()
