"""Refusal evidence preserves effects without leaking them across call boundaries."""

import asyncio
import inspect
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ocade_agent.sandbox import Refused, guarded, mark_effect, output_path, write_atomically


class EffectScopeTest(unittest.TestCase):
    def test_precondition_refusal_and_unscoped_mark_do_not_leak(self):
        @guarded
        def refuse(value: str = "unused") -> dict:
            raise Refused("precondition")

        mark_effect()
        self.assertEqual(refuse(), {"refused": "precondition", "maybeChanged": False})
        self.assertEqual(inspect.signature(refuse), inspect.signature(refuse.__wrapped__))
        self.assertFalse(inspect.iscoroutinefunction(refuse))

    def test_unexpected_exception_resets_scope(self):
        @guarded
        def crash():
            mark_effect()
            raise RuntimeError("lost readback")

        @guarded
        def refuse():
            raise Refused("precondition")

        with self.assertRaisesRegex(RuntimeError, "lost readback"):
            crash()
        self.assertEqual(refuse(), {"refused": "precondition", "maybeChanged": False})

    def test_published_file_survives_later_refusal_as_partial_effect(self):
        with tempfile.TemporaryDirectory() as directory:
            target = output_path(directory, "OCADE output/first.txt")

            @guarded
            def write_then_refuse():
                write_atomically(target, lambda temporary: temporary.write_bytes(b"published"))
                raise Refused("second_output_refused")

            self.assertEqual(write_then_refuse(),
                             {"refused": "second_output_refused", "maybeChanged": True})
            self.assertEqual(target.read_bytes(), b"published")

    def test_failed_publication_preserves_customer_bytes_without_claiming_our_effect(self):
        with tempfile.TemporaryDirectory() as directory:
            target = output_path(directory, "OCADE output/race.txt")
            exists = Path.exists

            def customer_writes_after_check(path):
                present = exists(path)
                if path == target and not present:
                    path.write_bytes(b"customer work")
                return present

            @guarded
            def publish():
                return {"sha256": write_atomically(
                    target, lambda temporary: temporary.write_bytes(b"agent output"))}

            with patch.object(Path, "exists", customer_writes_after_check):
                self.assertEqual(publish(), {"refused": "output_exists", "maybeChanged": False})
            self.assertEqual(target.read_bytes(), b"customer work")
            self.assertEqual(list(target.parent.glob(".ocade-*")), [])

    def test_nested_effect_reaches_parent_after_inner_scope_resets(self):
        @guarded
        def child():
            mark_effect()
            return {"observed": True}

        @guarded
        def parent():
            child()
            raise Refused("later_refusal")

        self.assertEqual(parent(), {"refused": "later_refusal", "maybeChanged": True})

    def test_nested_explicit_admission_reaches_parent(self):
        @guarded
        def child():
            return {"refused": "legacy_partial_effect", "maybeChanged": True}

        @guarded
        def parent():
            child()
            raise Refused("parent_failed")

        self.assertEqual(parent(), {"refused": "parent_failed", "maybeChanged": True})

    def test_returned_child_refusal_retains_earlier_parent_effect(self):
        @guarded
        def child():
            raise Refused("precondition")

        @guarded
        def parent():
            mark_effect()
            return child()

        self.assertEqual(parent(), {"refused": "precondition", "maybeChanged": True})


class AsyncEffectScopeTest(unittest.IsolatedAsyncioTestCase):
    async def test_async_signature_and_scope_reset_after_cancellation(self):
        @guarded
        async def cancel(value: str = "unused") -> dict:
            mark_effect()
            raise asyncio.CancelledError()

        @guarded
        async def refuse():
            raise Refused("precondition")

        self.assertTrue(inspect.iscoroutinefunction(cancel))
        self.assertEqual(inspect.signature(cancel), inspect.signature(cancel.__wrapped__))
        with self.assertRaises(asyncio.CancelledError):
            await cancel()
        self.assertEqual(await refuse(), {"refused": "precondition", "maybeChanged": False})

    async def test_concurrent_children_have_independent_flags_and_parent_keeps_effect(self):
        changed = asyncio.Event()
        results = []

        @guarded
        async def mutate():
            mark_effect()
            changed.set()
            await asyncio.sleep(0)
            raise Refused("readback_failed")

        @guarded
        async def refuse():
            await changed.wait()
            raise Refused("precondition")

        @guarded
        async def parent():
            results.extend(await asyncio.gather(mutate(), refuse()))
            raise Refused("parent_failed")

        self.assertEqual(await parent(), {"refused": "parent_failed", "maybeChanged": True})
        self.assertEqual(results, [
            {"refused": "readback_failed", "maybeChanged": True},
            {"refused": "precondition", "maybeChanged": False},
        ])
        # A later call on the same task starts clean after the parent's reset.
        self.assertEqual(await refuse(), {"refused": "precondition", "maybeChanged": False})


if __name__ == "__main__":
    unittest.main()
