from collections import deque
from typing import Optional
from app.config import settings
class MovingAverageFilter:
    """
    Smooths a stream of float values using a sliding window average.
    Designed to reduce jitter in joint angle signals.
    """
    def __init__(self, window_size: int = settings.SMOOTHING_WINDOW_SIZE):
        self._window_size = window_size
        self._buffer: deque[float] = deque(maxlen=window_size)
    def update(self, value: float) -> float:
        """
        Add a new value and return the current smoothed output.
        During warm-up (fewer values than window_size), averages available values.
        """
        self._buffer.append(value)
        return sum(self._buffer) / len(self._buffer)
    def reset(self):
        """Clear the buffer (use between reps or exercises)."""
        self._buffer.clear()
    @property
    def is_warmed_up(self) -> bool:
        """True when the buffer is full (past the warm-up phase)."""
        return len(self._buffer) == self._window_size
def smooth_sequence(values: list[Optional[float]], window_size: int = settings.SMOOTHING_WINDOW_SIZE) -> list[Optional[float]]:
    """
    Apply moving average to a complete list of values.
    None values are skipped (not fed into the average, kept as None in output).
    Useful for post-processing a full video's angle sequence.
    """
    result: list[Optional[float]] = []
    f = MovingAverageFilter(window_size)
    for v in values:
        if v is None:
            result.append(None)
        else:
            result.append(f.update(v))
    return result