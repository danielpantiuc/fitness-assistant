from enum import Enum, auto
from typing import Optional
from loguru import logger
from app.config import settings
from .base import CompletedRep

class DeadliftPhase(Enum):
    BOTTOM = auto()      
    ASCENDING = auto()   
    STANDING = auto()    
    DESCENDING = auto()  

class DeadliftStateMachine:
    """
    Finite state machine that detects deadlift repetitions
    from a stream of hip angles.
    ~170° = standing tall, ~90° = bent over at bottom.
    """

    def __init__(self):
        self._state = DeadliftPhase.STANDING  # We start standing, user will walk to bar
        self._rep_count = 0
        self._frame_index = 0
        self._rep_start_frame = 0
        self._min_hip_angle_in_rep = 180.0
        self._max_trunk_lean_in_rep: Optional[float] = None
        self._max_bar_distance_in_rep: Optional[float] = None
        self._descent_start_frame: int = 0
        self._descent_frame_count: int = 0

    @property
    def current_phase(self) -> DeadliftPhase:
        return self._state

    @property
    def rep_count(self) -> int:
        return self._rep_count

    def update(
            self,
            hip_angle: float,
            trunk_lean: Optional[float] = None,
            bar_distance: Optional[float] = None,
    ) -> Optional[CompletedRep]:
        """
        Process a single frame's hip angle and advance the state machine.
        Returns a CompletedRep when a full rep is detected.
        """
        frame = self._frame_index
        self._frame_index += 1

        self._min_hip_angle_in_rep = min(self._min_hip_angle_in_rep, hip_angle)
        if trunk_lean is not None:
            if self._max_trunk_lean_in_rep is None:
                self._max_trunk_lean_in_rep = trunk_lean
            else:
                self._max_trunk_lean_in_rep = max(self._max_trunk_lean_in_rep, trunk_lean)
        if bar_distance is not None:
            if self._max_bar_distance_in_rep is None:
                self._max_bar_distance_in_rep = bar_distance
            else:
                self._max_bar_distance_in_rep = max(self._max_bar_distance_in_rep, bar_distance)

        buf = settings.DL_HYSTERESIS

        if self._state == DeadliftPhase.STANDING:
            if hip_angle < settings.DL_DESCENDING_ANGLE:
                self._state = DeadliftPhase.DESCENDING
                self._descent_start_frame = frame
                logger.debug(f"Frame {frame}: STANDING → DESCENDING (hip={hip_angle:.1f}°)")

        elif self._state == DeadliftPhase.DESCENDING:
            if hip_angle < settings.DL_BOTTOM_ANGLE:
                self._state = DeadliftPhase.BOTTOM
                self._descent_frame_count = frame - self._descent_start_frame
                
                if self._rep_start_frame > 0:
                    self._rep_count += 1
                    completed = CompletedRep(
                        rep_number=self._rep_count,
                        min_knee_angle=0.0,
                        min_hip_angle=self._min_hip_angle_in_rep,
                        max_trunk_lean=self._max_trunk_lean_in_rep,
                        frame_start=self._rep_start_frame,
                        frame_end=frame,
                        descent_frame_count=self._descent_frame_count,
                        max_bar_distance=self._max_bar_distance_in_rep,
                    )
                    logger.info(f" Deadlift Rep #{self._rep_count} completed at bottom! max_hip={self._min_hip_angle_in_rep:.1f}°") # Note: min_hip is actually the max bent over angle, wait, in DL min_hip is at bottom, max_hip is at top.
                    
                    self._rep_start_frame = 0
                    self._reset_rep_tracking(hip_angle, trunk_lean, bar_distance)
                    return completed
                else:
                    logger.debug(f"Frame {frame}: DESCENDING → BOTTOM (getting into starting position)")

            elif hip_angle > settings.DL_DESCENDING_ANGLE + buf:
                self._state = DeadliftPhase.STANDING
                logger.debug(f"Frame {frame}: DESCENDING → STANDING (aborted descent, hip={hip_angle:.1f}°)")

        elif self._state == DeadliftPhase.BOTTOM:
            if hip_angle > settings.DL_ASCENDING_ANGLE + buf:
                self._state = DeadliftPhase.ASCENDING
                self._rep_start_frame = frame
                self._reset_rep_tracking(hip_angle, trunk_lean, bar_distance)
                logger.debug(f"Frame {frame}: BOTTOM → ASCENDING (hip={hip_angle:.1f}°)")

        elif self._state == DeadliftPhase.ASCENDING:
            if hip_angle > settings.DL_LOCKOUT_RETURN_ANGLE:
                self._state = DeadliftPhase.STANDING
                logger.debug(f"Frame {frame}: ASCENDING → STANDING (Lockout achieved, hip={hip_angle:.1f}°)")
            elif hip_angle < settings.DL_BOTTOM_ANGLE - buf:
                self._state = DeadliftPhase.BOTTOM
                self._rep_start_frame = 0  # Aborted rep
                logger.debug(f"Frame {frame}: ASCENDING → BOTTOM (aborted pull, hip={hip_angle:.1f}°)")

        return None

    def _reset_rep_tracking(
            self,
            hip_angle: float,
            trunk_lean: Optional[float],
            bar_distance: Optional[float],
    ):
        self._min_hip_angle_in_rep = hip_angle
        self._max_trunk_lean_in_rep = trunk_lean
        self._max_bar_distance_in_rep = bar_distance
