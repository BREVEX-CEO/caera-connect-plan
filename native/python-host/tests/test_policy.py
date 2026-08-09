from __future__ import annotations

import pytest

from ocade_native.policy import PolicyError, validate_request


def request(command: str, **extra: object) -> dict[str, object]:
    return {"id": "test-1", "command": command, "params": {}, **extra}


def test_health_is_read_only() -> None:
    request_id, command, params, policy = validate_request(request("health"))
    assert (request_id, command, params, policy.mutates) == ("test-1", "health", {}, False)


def test_unknown_command_is_refused() -> None:
    with pytest.raises(PolicyError, match="allowlisted"):
        validate_request(request("shell.exec"))


def test_mutation_requires_exact_scope_and_approval() -> None:
    payload = request("pointer.click")
    payload["params"] = {"x": 0.5, "y": 0.5}
    with pytest.raises(PolicyError, match=r"desktop\.pointer"):
        validate_request(payload)
    payload.update({"approved": True, "scope": "desktop.pointer"})
    assert validate_request(payload)[1] == "pointer.click"


def test_arbitrary_executable_and_key_are_refused() -> None:
    launch = request("app.launch", approved=True, scope="desktop.launch")
    launch["params"] = {"app": "powershell"}
    with pytest.raises(PolicyError, match="application"):
        validate_request(launch)
    key = request("key.press", approved=True, scope="desktop.input")
    key["params"] = {"key": "win+r"}
    with pytest.raises(PolicyError, match="key chord"):
        validate_request(key)


def test_coordinates_and_payloads_are_bounded() -> None:
    payload = request("pointer.move", approved=True, scope="desktop.pointer")
    payload["params"] = {"x": 1.1, "y": 0.5}
    with pytest.raises(PolicyError, match="normalized"):
        validate_request(payload)
    payload["params"] = {"x": 0.5, "y": 0.5, "note": "x" * 4_001}
    with pytest.raises(PolicyError, match="4000"):
        validate_request(payload)


def test_discovery_is_read_only_but_scope_gated() -> None:
    payload = request("apps.discover")
    payload["params"] = {"limit": 25}
    with pytest.raises(PolicyError, match=r"desktop\.inspect"):
        validate_request(payload)
    payload.update({"approved": True, "scope": "desktop.inspect"})
    _, command, _, policy = validate_request(payload)
    assert command == "apps.discover"
    assert policy.mutates is False


def test_only_discovery_shaped_ids_can_reach_dynamic_launch() -> None:
    discovered = "winapp:" + "a" * 64
    launch = request("app.launch", approved=True, scope="desktop.launch")
    launch["params"] = {"app": discovered}
    assert validate_request(launch)[1] == "app.launch"
    inspect = request("app.inspect", approved=True, scope="desktop.inspect")
    inspect["params"] = {"appId": discovered}
    assert validate_request(inspect)[1] == "app.inspect"
    inspect["params"] = {"appId": "winapp:not-a-digest"}
    with pytest.raises(PolicyError, match="discovery"):
        validate_request(inspect)


def test_discovery_limits_are_bounded() -> None:
    payload = request("apps.discover", approved=True, scope="desktop.inspect")
    payload["params"] = {"limit": 251}
    with pytest.raises(PolicyError, match="between 1 and 250"):
        validate_request(payload)
