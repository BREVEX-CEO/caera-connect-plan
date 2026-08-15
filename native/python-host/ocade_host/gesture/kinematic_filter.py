"""Adaptive One Euro filters for stable, low-latency pointer coordinates.

This is a small implementation of the algorithm described by Casiez, Roussel
and Vogel. It has no SciPy dependency and is deterministic enough to exercise
with recorded landmark coordinates in unit tests.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


def _alpha(dt: float, cutoff: float) -> float:
    if dt <= 0:
        raise ValueError("OneEuroFilter timestamps must increase.")
    if cutoff <= 0:
        raise ValueError("OneEuroFilter cutoff must be positive.")
    rate = 2.0 * math.pi * cutoff * dt
    return rate / (rate + 1.0)


class _LowPass:
    def __init__(self) -> None:
        self.value: float | None = None

    def apply(self, value: float, alpha: float) -> float:
        if self.value is None:
            self.value = value
        else:
            self.value = alpha * value + (1.0 - alpha) * self.value
        return self.value

    def reset(self) -> None:
        self.value = None


class OneEuroFilter:
    """Filter one scalar signal using an adaptive low-pass cutoff."""

    def __init__(
        self,
        *,
        min_cutoff: float = 1.2,
        beta: float = 0.04,
        derivative_cutoff: float = 1.0,
    ) -> None:
        if min_cutoff <= 0 or derivative_cutoff <= 0 or beta < 0:
            raise ValueError("Invalid OneEuroFilter parameters.")
        self.min_cutoff = min_cutoff
        self.beta = beta
        self.derivative_cutoff = derivative_cutoff
        self._signal = _LowPass()
        self._derivative = _LowPass()
        self._last_raw: float | None = None
        self._last_time: float | None = None

    def __call__(self, value: float, timestamp: float) -> float:
        value = float(value)
        timestamp = float(timestamp)
        if not math.isfinite(value) or not math.isfinite(timestamp):
            raise ValueError("OneEuroFilter accepts finite values only.")

        if self._last_time is None or self._last_raw is None:
            self._last_time = timestamp
            self._last_raw = value
            return self._signal.apply(value, 1.0)

        dt = timestamp - self._last_time
        if dt <= 0:
            raise ValueError("OneEuroFilter timestamps must increase.")

        raw_derivative = (value - self._last_raw) / dt
        derivative = self._derivative.apply(
            raw_derivative,
            _alpha(dt, self.derivative_cutoff),
        )
        cutoff = self.min_cutoff + self.beta * abs(derivative)
        filtered = self._signal.apply(value, _alpha(dt, cutoff))
        self._last_time = timestamp
        self._last_raw = value
        return filtered

    def reset(self) -> None:
        self._signal.reset()
        self._derivative.reset()
        self._last_raw = None
        self._last_time = None


@dataclass
class PointOneEuroFilter:
    """Two-dimensional One Euro filter with identical tuning per axis."""

    min_cutoff: float = 1.2
    beta: float = 0.04
    derivative_cutoff: float = 1.0

    def __post_init__(self) -> None:
        self._x = OneEuroFilter(
            min_cutoff=self.min_cutoff,
            beta=self.beta,
            derivative_cutoff=self.derivative_cutoff,
        )
        self._y = OneEuroFilter(
            min_cutoff=self.min_cutoff,
            beta=self.beta,
            derivative_cutoff=self.derivative_cutoff,
        )

    def apply(self, x: float, y: float, timestamp: float) -> tuple[float, float]:
        return self._x(x, timestamp), self._y(y, timestamp)

    def reset(self) -> None:
        self._x.reset()
        self._y.reset()
