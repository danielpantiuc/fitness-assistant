from dataclasses import dataclass
from typing import Optional

@dataclass
class CompletedRep:
    """Metadata captured at the moment a rep is completed."""
    rep_number: int
    min_knee_angle: float        # Cel mai mic unghi atins (adâncimea squat-ului)
    min_hip_angle: Optional[float]
    max_trunk_lean: Optional[float]
    frame_start: int             # Frame-ul la care a început rep-ul
    frame_end: int               # Frame-ul la care s-a terminat rep-ul
    descent_frame_count: int = 0 # Câte frame-uri a durat coborârea
    trunk_lean_at_bottom: Optional[float] = None
    max_trunk_lean_ascending: Optional[float] = None
    min_elbow_angle: Optional[float] = None  # For bench press
    max_back_arch: Optional[float] = None    # For bench press
    max_bar_distance: Optional[float] = None # For deadlift
