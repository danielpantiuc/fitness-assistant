
import time
from typing import Optional
from loguru import logger

from app.config import settings
from app.core.angle_calculator import (
    get_knee_angle,
    get_hip_angle,
    get_trunk_lean_angle,
    get_heel_lift_indicator,
)
from app.core.signal_filter import MovingAverageFilter
from app.core.state_machines.base import CompletedRep
from app.core.state_machines.squat_machine import SquatStateMachine
from app.core.biomechanics.base import ExerciseAnalyzer, AnalysisReport, RepReport


class SquatAnalyzer(ExerciseAnalyzer):
    """
    Analyzes squat form from a sequence of pose landmarks.

    Active checks (reliable from lateral camera view):
      1. Depth             — knee angle must go below DEPTH_THRESHOLD (95°)
      2. Trunk lean        — forward lean must not exceed TRUNK_LEAN_MAX (55°)
      3. Heel lift         — heels rising off the ground for more than HEEL_LIFT_MIN_SECONDS
      4. Descent tempo     — controlled descent (min SQUAT_MIN_DESCENT_SECONDS)
      5. Hips shooting up  — trunk lean must not increase excessively on the way up
    """

    def analyze(self, landmarks_per_frame: list, fps: float = 30.0) -> AnalysisReport:
        start_time = time.time()
        logger.info(f"SquatAnalyzer: processing {len(landmarks_per_frame)} frames")

        valid_frames = [lm for lm in landmarks_per_frame if lm is not None]
        valid_ratio = len(valid_frames) / len(landmarks_per_frame) if landmarks_per_frame else 0

        if valid_ratio < settings.MIN_VALID_FRAMES_RATIO:
            logger.warning(f"Too few valid frames ({valid_ratio:.1%}). Cannot analyze.")
            return AnalysisReport(
                total_reps=0,
                overall_score=0.0,
                feedback=["Video quality too low: not enough pose detections. Ensure good lighting and full body visibility."],
            )

        state_machine = SquatStateMachine()
        knee_filter = MovingAverageFilter()
        hip_filter = MovingAverageFilter()
        trunk_filter = MovingAverageFilter()

        frame_heel_lifts: list[Optional[float]] = []
        frame_left_knee_angles: list[Optional[float]] = []
        frame_right_knee_angles: list[Optional[float]] = []

        completed_reps: list[CompletedRep] = []

        facing_side = self.detect_facing_side(landmarks_per_frame)
        logger.info(f"SquatAnalyzer: auto-detected facing side = {facing_side}")

        for landmarks in landmarks_per_frame:
            if landmarks is None:
                frame_heel_lifts.append(None)
                frame_left_knee_angles.append(None)
                frame_right_knee_angles.append(None)
                continue

            raw_knee = get_knee_angle(landmarks, side=facing_side)
            raw_hip = get_hip_angle(landmarks, side=facing_side)
            raw_trunk = get_trunk_lean_angle(landmarks)
            
            heel_lift = get_heel_lift_indicator(landmarks, side=facing_side)
            
            occluded_side = "RIGHT" if facing_side == "LEFT" else "LEFT"
            other_knee = get_knee_angle(landmarks, side=occluded_side)

            if raw_knee is not None and raw_knee < settings.KNEE_ANGLE_MIN_VALID:
                logger.debug(f"Skipping frame: knee_angle={raw_knee:.1f}° below anatomical minimum ({settings.KNEE_ANGLE_MIN_VALID}°)")
                raw_knee = None

            frame_heel_lifts.append(heel_lift)
            frame_left_knee_angles.append(raw_knee if facing_side == "LEFT" else other_knee)
            frame_right_knee_angles.append(raw_knee if facing_side == "RIGHT" else other_knee)

            if raw_knee is None:
                continue

            smooth_knee = knee_filter.update(raw_knee)
            smooth_hip = hip_filter.update(raw_hip) if raw_hip is not None else None
            smooth_trunk = trunk_filter.update(raw_trunk) if raw_trunk is not None else None

            completed = state_machine.update(smooth_knee, smooth_hip, smooth_trunk)
            if completed:
                completed_reps.append(completed)

        logger.info(f"Detected {len(completed_reps)} completed reps.")

        per_frame_data = {
            "heel_lifts": frame_heel_lifts,
            "left_knee_angles": frame_left_knee_angles,
            "right_knee_angles": frame_right_knee_angles,
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
        """Apply biomechanical rules to a single rep and compute its score."""
        errors: list[str] = []
        deductions = 0.0

        start = rep.frame_start
        end = rep.frame_end

        if rep.min_knee_angle > settings.DEPTH_THRESHOLD:
            errors.append(
                f"Insufficient depth: knee angle reached only {rep.min_knee_angle:.0f}° "
                f"(target: below {settings.DEPTH_THRESHOLD:.0f}°). Lower your hips to at least parallel."
            )
            deductions += 25.0

        if rep.max_trunk_lean is not None and rep.max_trunk_lean > settings.TRUNK_LEAN_MAX:
            errors.append(
                f"Excessive forward lean: trunk reached {rep.max_trunk_lean:.0f}° "
                f"(max: {settings.TRUNK_LEAN_MAX:.0f}°). Keep your chest up and improve ankle mobility."
            )
            deductions += 20.0

        rep_heels = per_frame_data["heel_lifts"][start:end]
        current_lift_frames = 0
        heel_lifted = False
        for hl in rep_heels:
            if hl is not None and hl > settings.HEEL_LIFT_TOLERANCE:
                current_lift_frames += 1
            else:
                if current_lift_frames / fps > settings.HEEL_LIFT_MIN_SECONDS if fps > 0 else 0:
                    heel_lifted = True
                current_lift_frames = 0
        
        if current_lift_frames / fps > settings.HEEL_LIFT_MIN_SECONDS if fps > 0 else 0:
            heel_lifted = True
        
        if heel_lifted:
            errors.append(
                f"Heel lift detected: heels raised off the ground. "
                "Work on ankle mobility or try squat shoes / heel wedges."
            )
            deductions += 10.0

        descent_time_sec = rep.descent_frame_count / fps if fps > 0 else 0
        if rep.descent_frame_count > 0 and descent_time_sec < settings.SQUAT_MIN_DESCENT_SECONDS:
            errors.append(
                f"Descent too fast ({descent_time_sec:.1f}s, "
                f"target > {settings.SQUAT_MIN_DESCENT_SECONDS}s). Control the eccentric phase."
            )
            deductions += 15.0

        if rep.trunk_lean_at_bottom is not None and rep.max_trunk_lean_ascending is not None:
            if rep.max_trunk_lean_ascending > rep.trunk_lean_at_bottom + settings.HIPS_SHOOTING_UP_TOLERANCE:
                errors.append(
                    f"Hips shooting up (Good Morning Squat): Trunk lean increased on the way up "
                    f"({rep.max_trunk_lean_ascending:.0f}° vs {rep.trunk_lean_at_bottom:.0f}° at bottom). "
                    "Drive your chest and hips up at the same time."
                )
                deductions += 15.0

        score = max(0.0, 100.0 - deductions)

        metrics = {
            "min_knee_angle": round(rep.min_knee_angle, 1),
        }
        if rep.min_hip_angle is not None:
            metrics["min_hip_angle"] = round(rep.min_hip_angle, 1)
        if rep.max_trunk_lean is not None:
            metrics["max_trunk_lean"] = round(rep.max_trunk_lean, 1)

        return RepReport(
            rep_number=rep.rep_number,
            score=round(score, 1),
            errors=errors,
            min_knee_angle=round(rep.min_knee_angle, 1),
            min_hip_angle=round(rep.min_hip_angle, 1) if rep.min_hip_angle else None,
            max_trunk_lean=round(rep.max_trunk_lean, 1) if rep.max_trunk_lean else None,
            frame_start=rep.frame_start,
            frame_end=rep.frame_end,
            exercise_metrics=metrics,
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

        depth_fails = sum(1 for r in rep_reports if any("depth" in e.lower() for e in r.errors))
        lean_fails = sum(1 for r in rep_reports if any("excessive forward lean" in e.lower() for e in r.errors))
        heel_fails = sum(1 for r in rep_reports if any("heel lift" in e.lower() for e in r.errors))
        tempo_fails = sum(1 for r in rep_reports if any("descent too fast" in e.lower() for e in r.errors))
        hips_up_fails = sum(1 for r in rep_reports if any("hips shooting up" in e.lower() for e in r.errors))

        if depth_fails / total >= 0.5:
            feedback.append("Work on squat depth — aim to get your hips to at least parallel (hip crease at knee level).")
        if lean_fails / total >= 0.5:
            feedback.append("Excessive forward lean detected — strengthen your core and improve ankle mobility with calf stretches.")
        if heel_fails / total >= 0.5:
            feedback.append("Heels lifting off the ground — work on ankle dorsiflexion mobility or use heel wedges / squat shoes.")
        if tempo_fails / total >= 0.5:
            feedback.append("Descending too fast — aim for a slow 2-3 second controlled descent on every rep.")
        if hips_up_fails / total >= 0.5:
            feedback.append("Hips shooting up first — focus on driving your upper back into the bar and rising with hips and chest simultaneously.")

        if not feedback:
            feedback.append("Good squat form overall. Focus on maintaining consistency across all reps.")

        return feedback
