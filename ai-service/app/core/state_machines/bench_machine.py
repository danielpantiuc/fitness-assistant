from enum import Enum, auto
from typing import Optional
from loguru import logger
from app.config import settings
from .base import CompletedRep

class BenchPhase(Enum):
    LOCKOUT = auto()     
    DESCENDING = auto()  
    BOTTOM = auto()      
    ASCENDING = auto()   

class BenchPressStateMachine:
    """
    Finite state machine that detects bench press repetitions
    from a stream of elbow angles.
    ~170° = lockout (arms extended), ~90° = bar at chest.
    """

    def __init__(self):
        self._state = BenchPhase.LOCKOUT
        self._rep_count = 0
        self._frame_index = 0
        self._rep_start_frame = 0
        self._min_elbow_angle_in_rep = 180.0
        self._max_back_arch_in_rep: Optional[float] = None
        self._descent_start_frame: int = 0
        self._descent_frame_count: int = 0

    @property
    def current_phase(self) -> BenchPhase:
        return self._state

    @property
    def rep_count(self) -> int:
        return self._rep_count

    def update(
            self,
            elbow_angle: float,
            back_arch: Optional[float] = None,
    ) -> Optional[CompletedRep]:
        """
        Process a single frame's elbow angle and advance the state machine.
        Returns a CompletedRep when a full rep is detected.
        """
        frame = self._frame_index
        self._frame_index += 1

        self._min_elbow_angle_in_rep = min(self._min_elbow_angle_in_rep, elbow_angle)
        if back_arch is not None:
            if self._max_back_arch_in_rep is None:
                self._max_back_arch_in_rep = back_arch
            else:
                self._max_back_arch_in_rep = max(self._max_back_arch_in_rep, back_arch)

        buf = settings.BENCH_HYSTERESIS

        if self._state == BenchPhase.LOCKOUT:
            if elbow_angle < settings.BENCH_DESCENDING_ANGLE:
                self._state = BenchPhase.DESCENDING
                self._rep_start_frame = frame
                self._descent_start_frame = frame
                self._reset_rep_tracking(elbow_angle, back_arch)
                logger.debug(f"Frame {frame}: LOCKOUT → DESCENDING (elbow={elbow_angle:.1f}°)")

        elif self._state == BenchPhase.DESCENDING:
            if elbow_angle < settings.BENCH_BOTTOM_ANGLE:
                self._state = BenchPhase.BOTTOM
                self._descent_frame_count = frame - self._descent_start_frame
                logger.debug(f"Frame {frame}: DESCENDING → BOTTOM (elbow={elbow_angle:.1f}°)")
            elif elbow_angle > settings.BENCH_DESCENDING_ANGLE + buf:
                self._state = BenchPhase.LOCKOUT
                logger.debug(f"Frame {frame}: DESCENDING → LOCKOUT (aborted, elbow={elbow_angle:.1f}°)")

        elif self._state == BenchPhase.BOTTOM:
            if elbow_angle > settings.BENCH_ASCENDING_ANGLE + buf:
                self._state = BenchPhase.ASCENDING
                logger.debug(f"Frame {frame}: BOTTOM → ASCENDING (elbow={elbow_angle:.1f}°)")

        elif self._state == BenchPhase.ASCENDING:
            if elbow_angle > settings.BENCH_STANDING_RETURN_ANGLE:
                self._rep_count += 1
                completed = CompletedRep(
                    rep_number=self._rep_count,
                    min_knee_angle=0.0,  # Not relevant for bench
                    min_hip_angle=None,
                    max_trunk_lean=None,
                    frame_start=self._rep_start_frame,
                    frame_end=frame,
                    descent_frame_count=self._descent_frame_count,
                    min_elbow_angle=self._min_elbow_angle_in_rep,
                    max_back_arch=self._max_back_arch_in_rep,
                )
                self._state = BenchPhase.LOCKOUT
                self._reset_rep_tracking(elbow_angle, back_arch)
                logger.info(f" Bench Rep #{self._rep_count} completed! min_elbow={completed.min_elbow_angle:.1f}°")
                return completed
            elif elbow_angle < settings.BENCH_BOTTOM_ANGLE - buf:
                self._state = BenchPhase.BOTTOM
                logger.debug(f"Frame {frame}: ASCENDING → BOTTOM (elbow={elbow_angle:.1f}°)")

        return None

    def _reset_rep_tracking(self, elbow_angle: float, back_arch: Optional[float]):
        self._min_elbow_angle_in_rep = elbow_angle
        self._max_back_arch_in_rep = back_arch
