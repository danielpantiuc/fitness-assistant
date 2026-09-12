from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class RepReport:
    """
    Analysis result for a single repetition.
    Stored in DB as a row in rep_details.
    """
    rep_number: int
    score: float               # 0–100
    errors: list[str]          # List of form error descriptions
    min_knee_angle: Optional[float] = None
    min_hip_angle: Optional[float] = None
    max_trunk_lean: Optional[float] = None
    max_pelvic_tilt: Optional[float] = None
    max_knee_valgus: Optional[float] = None
    max_heel_lift: Optional[float] = None
    bar_position_offset: Optional[float] = None
    descent_time_frames: Optional[int] = None
    symmetry_diff: Optional[float] = None
    frame_start: int = 0
    frame_end: int = 0
    exercise_metrics: dict = field(default_factory=dict)  # Exercise-specific metrics (JSON)


@dataclass
class AnalysisReport:
    """
    Full analysis result for a video.
    Top-level object stored in DB as analysis_results.
    """
    total_reps: int
    overall_score: float                    # Average of rep scores
    rep_details: list[RepReport] = field(default_factory=list)
    feedback: list[str] = field(default_factory=list)   # Aggregated tips
    landmark_summary: dict = field(default_factory=dict)
    processing_time_ms: int = 0


class ExerciseAnalyzer(ABC):
    """
    Abstract base class for all exercise analyzers.
    Subclasses implement exercise-specific biomechanical logic.
    """

    @abstractmethod
    def analyze(
            self,
            landmarks_per_frame: list,  
            fps: float = 30.0,
    ) -> AnalysisReport:
        """
        Process all landmarks from a video and return a complete analysis.
        """
        ...

    def detect_facing_side(self, landmarks_per_frame: list) -> str:
        """
        Auto-detects whether the LEFT or RIGHT side of the body is facing the camera.
        It averages the MediaPipe 'visibility' scores of the hip, knee, and ankle
        over the entire video. The side with the higher average visibility is the
        one facing the camera (since the other side is occluded and guessed by the AI).
        Returns: "LEFT" or "RIGHT".
        """
        left_score = 0.0
        right_score = 0.0
        valid_frames = 0

        for landmarks in landmarks_per_frame:
            if landmarks is None:
                continue
            
            valid_frames += 1
            
            l_hip = landmarks.get("LEFT_HIP", {}).get("visibility", 0)
            l_knee = landmarks.get("LEFT_KNEE", {}).get("visibility", 0)
            l_ankle = landmarks.get("LEFT_ANKLE", {}).get("visibility", 0)
            left_score += (l_hip + l_knee + l_ankle) / 3.0
            
            r_hip = landmarks.get("RIGHT_HIP", {}).get("visibility", 0)
            r_knee = landmarks.get("RIGHT_KNEE", {}).get("visibility", 0)
            r_ankle = landmarks.get("RIGHT_ANKLE", {}).get("visibility", 0)
            right_score += (r_hip + r_knee + r_ankle) / 3.0

        if valid_frames == 0:
            return "LEFT"  # fallback

        return "LEFT" if left_score >= right_score else "RIGHT"
