from enum import Enum, auto
from typing import Optional
from loguru import logger
from app.config import settings
from .base import CompletedRep

class SquatPhase(Enum):
    STANDING = auto()    
    DESCENDING = auto()  
    BOTTOM = auto()      
    ASCENDING = auto()  

class SquatStateMachine:
    """
    Finite state machine that detects squat repetitions
    from a stream of knee angles.
    Feed one angle per frame via .update(). When a full rep is completed,
    .update() returns a CompletedRep object; otherwise returns None.
    """
    def __init__(self):
        self._state = SquatPhase.STANDING
        self._rep_count = 0
        self._frame_index = 0
        self._rep_start_frame = 0
        self._min_knee_angle_in_rep = 180.0
        self._min_hip_angle_in_rep: Optional[float] = None
        self._max_trunk_lean_in_rep: Optional[float] = None
        self._descent_start_frame: int = 0
        self._min_knee_frame: int = 0
        self._trunk_lean_at_bottom: Optional[float] = None
        self._max_trunk_lean_ascending: Optional[float] = None

    @property
    def current_phase(self) -> SquatPhase:
        return self._state

    @property
    def rep_count(self) -> int:
        return self._rep_count

    def update(
            self,
            knee_angle: float,
            hip_angle: Optional[float] = None,
            trunk_lean: Optional[float] = None,
    ) -> Optional[CompletedRep]:
        """
        Process a single frame's angles and advance the state machine.
        Returns a CompletedRep when a full repetition is detected,
        otherwise returns None.
        """
        frame = self._frame_index
        self._frame_index += 1
        if knee_angle < self._min_knee_angle_in_rep:
            self._min_knee_angle_in_rep = knee_angle
            self._min_knee_frame = frame
            if trunk_lean is not None:
                self._trunk_lean_at_bottom = trunk_lean
        
        if frame > self._min_knee_frame and trunk_lean is not None:
            if self._max_trunk_lean_ascending is None:
                self._max_trunk_lean_ascending = trunk_lean
            else:
                self._max_trunk_lean_ascending = max(self._max_trunk_lean_ascending, trunk_lean)
            
        if hip_angle is not None:
            if self._min_hip_angle_in_rep is None:
                self._min_hip_angle_in_rep = hip_angle
            else:
                self._min_hip_angle_in_rep = min(self._min_hip_angle_in_rep, hip_angle)
        if trunk_lean is not None:
            if self._max_trunk_lean_in_rep is None:
                self._max_trunk_lean_in_rep = trunk_lean
            else:
                self._max_trunk_lean_in_rep = max(self._max_trunk_lean_in_rep, trunk_lean)
        buf = settings.HYSTERESIS_BUFFER
        if self._state == SquatPhase.STANDING:
            if knee_angle < settings.DESCENDING_KNEE_ANGLE:
                self._state = SquatPhase.DESCENDING
                self._rep_start_frame = frame
                self._descent_start_frame = frame
                self._reset_rep_tracking(knee_angle, hip_angle, trunk_lean)
                logger.debug(f"Frame {frame}: STANDING → DESCENDING (knee={knee_angle:.1f}°)")
        elif self._state == SquatPhase.DESCENDING:
            if knee_angle < settings.BOTTOM_KNEE_ANGLE:
                self._state = SquatPhase.BOTTOM
                logger.debug(f"Frame {frame}: DESCENDING → BOTTOM (knee={knee_angle:.1f}°)")
            elif knee_angle > settings.DESCENDING_KNEE_ANGLE + buf:
                self._state = SquatPhase.STANDING
                logger.debug(f"Frame {frame}: DESCENDING → STANDING (aborted, knee={knee_angle:.1f}°)")
        elif self._state == SquatPhase.BOTTOM:
            if knee_angle > settings.ASCENDING_KNEE_ANGLE + buf:
                self._state = SquatPhase.ASCENDING
                logger.debug(f"Frame {frame}: BOTTOM → ASCENDING (knee={knee_angle:.1f}°)")
                
        elif self._state == SquatPhase.ASCENDING:

            if knee_angle > settings.STANDING_RETURN_ANGLE:
                self._rep_count += 1
                completed = CompletedRep(
                    rep_number=self._rep_count,
                    min_knee_angle=self._min_knee_angle_in_rep,
                    min_hip_angle=self._min_hip_angle_in_rep,
                    max_trunk_lean=self._max_trunk_lean_in_rep,
                    frame_start=self._rep_start_frame,
                    frame_end=frame,
                    descent_frame_count=self._min_knee_frame - self._descent_start_frame,
                    trunk_lean_at_bottom=self._trunk_lean_at_bottom,
                    max_trunk_lean_ascending=self._max_trunk_lean_ascending,
                )
                self._state = SquatPhase.STANDING
                self._reset_rep_tracking(knee_angle, hip_angle, trunk_lean)
                logger.info(f" Rep #{self._rep_count} completed! min_knee={completed.min_knee_angle:.1f}°")
                return completed
            elif knee_angle < settings.BOTTOM_KNEE_ANGLE - buf:
                self._state = SquatPhase.BOTTOM
                logger.debug(f"Frame {frame}: ASCENDING → BOTTOM (knee={knee_angle:.1f}°)")
        return None

    def _reset_rep_tracking(
            self,
            knee_angle: float,
            hip_angle: Optional[float],
            trunk_lean: Optional[float],
    ):
        self._min_knee_angle_in_rep = knee_angle
        self._min_knee_frame = self._frame_index - 1
        self._min_hip_angle_in_rep = hip_angle
        self._max_trunk_lean_in_rep = trunk_lean
        self._trunk_lean_at_bottom = None
        self._max_trunk_lean_ascending = None
