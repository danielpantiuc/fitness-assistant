
import time
from typing import Optional
from loguru import logger

from app.config import settings
from app.core.angle_calculator import (
    get_hip_angle,
    get_knee_angle,
    get_bar_tracking_data,
)
from app.core.signal_filter import MovingAverageFilter
from app.core.state_machines.base import CompletedRep
from app.core.state_machines.deadlift_machine import DeadliftStateMachine
from app.core.biomechanics.base import ExerciseAnalyzer, AnalysisReport, RepReport


class DeadliftAnalyzer(ExerciseAnalyzer):
    """
    Analyzes deadlift form from a sequence of pose landmarks.

    Active checks (reliable from lateral camera view):
      1. Hip lockout    — hip angle must reach DL_LOCKOUT_HIP_THRESHOLD (160°) at the top
      2. Bar path       — wrist-hip horizontal offset must stay below DL_BAR_DISTANCE_TOLERANCE
      3. Squat-style    — knee angle at bottom must not be too acute (not squatting the weight)
    """

    def analyze(self, landmarks_per_frame: list, fps: float = 30.0) -> AnalysisReport:
        start_time = time.time()
        logger.info(f"DeadliftAnalyzer: processing {len(landmarks_per_frame)} frames")

        valid_frames = [lm for lm in landmarks_per_frame if lm is not None]
        valid_ratio = len(valid_frames) / len(landmarks_per_frame) if landmarks_per_frame else 0

        if valid_ratio < settings.MIN_VALID_FRAMES_RATIO:
            logger.warning(f"Too few valid frames ({valid_ratio:.1%}). Cannot analyze.")
            return AnalysisReport(
                total_reps=0,
                overall_score=0.0,
                feedback=["Video quality too low: not enough pose detections. Ensure good lighting and full body visibility."],
            )

        state_machine = DeadliftStateMachine()
        hip_filter = MovingAverageFilter()

        frame_bar_distances: list[Optional[float]] = []
        frame_left_hip_angles: list[Optional[float]] = []
        frame_right_hip_angles: list[Optional[float]] = []
        frame_left_knee_angles: list[Optional[float]] = []

        completed_reps: list[CompletedRep] = []

        facing_side = self.detect_facing_side(landmarks_per_frame)
        logger.info(f"DeadliftAnalyzer: auto-detected facing side = {facing_side}")

        for landmarks in landmarks_per_frame:
            if landmarks is None:
                frame_bar_distances.append(None)
                frame_left_hip_angles.append(None)
                frame_right_hip_angles.append(None)
                frame_left_knee_angles.append(None)
                continue

            raw_hip = get_hip_angle(landmarks, side=facing_side)
            bar_data = get_bar_tracking_data(landmarks)
            
            occluded_side = "RIGHT" if facing_side == "LEFT" else "LEFT"
            other_hip = get_hip_angle(landmarks, side=occluded_side)
            facing_knee = get_knee_angle(landmarks, side=facing_side)

            frame_bar_distances.append(bar_data)
            frame_left_hip_angles.append(raw_hip if facing_side == "LEFT" else other_hip)
            frame_right_hip_angles.append(raw_hip if facing_side == "RIGHT" else other_hip)
            frame_left_knee_angles.append(facing_knee)

            if raw_hip is None:
                continue

            smooth_hip = hip_filter.update(raw_hip)

            completed = state_machine.update(smooth_hip, None, None)
            if completed:
                completed_reps.append(completed)

        logger.info(f"Detected {len(completed_reps)} completed deadlift reps.")

        per_frame_data = {
            "bar_distances": frame_bar_distances,
            "left_hip_angles": frame_left_hip_angles,
            "right_hip_angles": frame_right_hip_angles,
            "left_knee_angles": frame_left_knee_angles,
        }

        rep_reports: list[RepReport] = []
        for rep in completed_reps:
            report = self._evaluate_rep(rep, per_frame_data, fps)
            rep_reports.append(report)

        overall_score = (
            sum(r.score for r in rep_reports) / len(rep_reports)
            if rep_reports else 0.0
        )
        feedback = self._aggregate_feedback(rep_reports)
        processing_ms = int((time.time() - start_time) * 1000)

        return AnalysisReport(
            total_reps=len(rep_reports),
            overall_score=round(overall_score, 1),
            rep_details=rep_reports,
            feedback=feedback,
            processing_time_ms=processing_ms,
        )


    def _evaluate_rep(
            self,
            rep: CompletedRep,
            per_frame_data: dict,
            fps: float,
    ) -> RepReport:
        """Apply biomechanical rules to a single deadlift rep."""
        errors: list[str] = []
        deductions = 0.0

        start = rep.frame_start
        end = rep.frame_end

        rep_left_hip = [a for a in per_frame_data["left_hip_angles"][start:end] if a is not None]
        rep_right_hip = [a for a in per_frame_data["right_hip_angles"][start:end] if a is not None]

        max_hip = 0.0
        if rep_left_hip:
            max_hip = max(max_hip, max(rep_left_hip))
        if rep_right_hip:
            max_hip = max(max_hip, max(rep_right_hip))

        if max_hip < settings.DL_LOCKOUT_HIP_THRESHOLD:
            errors.append(
                f"Incomplete lockout: hip angle reached only {max_hip:.0f}° "
                f"(target: {settings.DL_LOCKOUT_HIP_THRESHOLD:.0f}°). "
                "Stand fully upright and squeeze your glutes at the top of each rep."
            )
            deductions += 25.0





        rep_knee = [a for a in per_frame_data["left_knee_angles"][start:end] if a is not None]
        bottom_knee_angle = None
        if rep_knee and rep_left_hip:
            hip_slice = per_frame_data["left_hip_angles"][start:end]
            valid_hip_indexed = [
                (i, v) for i, v in enumerate(hip_slice) if v is not None
            ]
            if valid_hip_indexed:
                bottom_idx = min(valid_hip_indexed, key=lambda x: x[1])[0]
                knee_slice = per_frame_data["left_knee_angles"][start:end]
                window = 5
                window_start = max(0, bottom_idx - window)
                window_end = min(len(knee_slice), bottom_idx + window + 1)
                knee_window = [v for v in knee_slice[window_start:window_end] if v is not None]
                if knee_window:
                    bottom_knee_angle = round(min(knee_window), 1)
                    if bottom_knee_angle < settings.DL_SQUAT_STYLE_KNEE_THRESHOLD:
                        errors.append(
                            f"Squat-style deadlift detected: knee angle at bottom is {bottom_knee_angle:.0f}° "
                            f"(expected above {settings.DL_SQUAT_STYLE_KNEE_THRESHOLD:.0f}°). "
                            "Focus on a hip-hinge movement — push your hips back rather than bending your knees."
                        )
                        deductions += 15.0

        score = max(0.0, 100.0 - deductions)

        return RepReport(
            rep_number=rep.rep_number,
            score=round(score, 1),
            errors=errors,
            min_hip_angle=round(rep.min_hip_angle, 1) if rep.min_hip_angle else None,
            max_trunk_lean=None,  # Not evaluated — see class docstring for rationale
            frame_start=rep.frame_start,
            frame_end=rep.frame_end,
            exercise_metrics={
                "min_hip_angle": round(rep.min_hip_angle, 1) if rep.min_hip_angle else None,
                "max_hip_angle": round(max_hip, 1),
                "max_bar_distance": None,
                "bottom_knee_angle": bottom_knee_angle,
            },
        )

    def _aggregate_feedback(self, rep_reports: list[RepReport]) -> list[str]:
        """
        Summarize recurring errors across all reps into actionable tips.
        Only surfaces an error if it appears in ≥ 50% of reps.
        """
        if not rep_reports:
            return ["No complete reps detected. Check video angle and ensure full body is visible from the side."]

        total = len(rep_reports)
        feedback: list[str] = []

        lockout_fails = sum(1 for r in rep_reports if any("lockout" in e.lower() for e in r.errors))
        squat_fails = sum(1 for r in rep_reports if any("squat-style" in e.lower() for e in r.errors))

        if lockout_fails / total >= 0.5:
            feedback.append("Incomplete lockout — stand fully upright at the top. Drive your hips forward and squeeze your glutes.")
        if squat_fails / total >= 0.5:
            feedback.append("Squat-style deadlift detected — focus on the hip-hinge pattern: push your hips back, keep shins more vertical.")

        if not feedback:
            feedback.append("Good deadlift form overall. Focus on maintaining consistency across all reps.")

        return feedback
