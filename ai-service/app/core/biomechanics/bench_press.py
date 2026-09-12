
import time
from typing import Optional
from loguru import logger

from app.config import settings
from app.core.angle_calculator import (
    get_elbow_angle,
    get_trunk_lean_angle,
)
from app.core.signal_filter import MovingAverageFilter
from app.core.state_machines.base import CompletedRep
from app.core.state_machines.bench_machine import BenchPressStateMachine
from app.core.biomechanics.base import ExerciseAnalyzer, AnalysisReport, RepReport


class BenchPressAnalyzer(ExerciseAnalyzer):
    """
    Analyzes bench press form from a sequence of pose landmarks.
    Camera should be positioned laterally (at bench height, from the side).

    Active checks:
      1. Incomplete lockout  — elbow angle must reach BENCH_LOCKOUT_THRESHOLD at the top
      2. Insufficient ROM    — elbow angle must go below BENCH_ROM_THRESHOLD at the bottom
      3. Hip lift off bench  — hip Y-coordinate must not rise significantly vs start position
    """

    def analyze(self, landmarks_per_frame: list, fps: float = 30.0) -> AnalysisReport:
        start_time = time.time()
        logger.info(f"BenchPressAnalyzer: processing {len(landmarks_per_frame)} frames")

        valid_frames = [lm for lm in landmarks_per_frame if lm is not None]
        valid_ratio = len(valid_frames) / len(landmarks_per_frame) if landmarks_per_frame else 0

        if valid_ratio < settings.MIN_VALID_FRAMES_RATIO:
            logger.warning(f"Too few valid frames ({valid_ratio:.1%}). Cannot analyze.")
            return AnalysisReport(
                total_reps=0,
                overall_score=0.0,
                feedback=["Video quality too low: not enough pose detections. Ensure good lighting and full body visibility."],
            )

        state_machine = BenchPressStateMachine()
        elbow_filter = MovingAverageFilter()

        frame_left_elbow_angles: list[Optional[float]] = []
        frame_right_elbow_angles: list[Optional[float]] = []
        frame_hip_px_y: list[Optional[float]] = []
        frame_trunk_angles: list[Optional[float]] = []
        global_max_hip_px_y = 0.0
        reference_torso_length = 0.0

        completed_reps: list[CompletedRep] = []

        for landmarks in landmarks_per_frame:
            if landmarks is None:
                frame_left_elbow_angles.append(None)
                frame_right_elbow_angles.append(None)
                frame_hip_px_y.append(None)
                continue

            raw_elbow_left = get_elbow_angle(landmarks, side="LEFT")
            raw_elbow_right = get_elbow_angle(landmarks, side="RIGHT")

            dims = landmarks.get("_IMAGE_DIMENSIONS", {"width": 1.0, "height": 1.0})
            w, h = dims["width"], dims["height"]

            hip_px_y = None
            torso_len = None
            try:
                hip_px_y = (landmarks["LEFT_HIP"]["y"] + landmarks["RIGHT_HIP"]["y"]) / 2 * h
                hip_px_x = (landmarks["LEFT_HIP"]["x"] + landmarks["RIGHT_HIP"]["x"]) / 2 * w
                shoulder_px_y = (landmarks["LEFT_SHOULDER"]["y"] + landmarks["RIGHT_SHOULDER"]["y"]) / 2 * h
                shoulder_px_x = (landmarks["LEFT_SHOULDER"]["x"] + landmarks["RIGHT_SHOULDER"]["x"]) / 2 * w
                import math
                torso_len = math.sqrt((shoulder_px_x - hip_px_x)**2 + (shoulder_px_y - hip_px_y)**2)
            except KeyError:
                pass

            frame_left_elbow_angles.append(raw_elbow_left)
            frame_right_elbow_angles.append(raw_elbow_right)
            frame_hip_px_y.append(hip_px_y)
            
            raw_trunk = get_trunk_lean_angle(landmarks)
            frame_trunk_angles.append(raw_trunk)
            
            if hip_px_y is not None and raw_trunk is not None and raw_trunk > 70 and torso_len is not None and torso_len > 0:
                if hip_px_y > global_max_hip_px_y:
                    global_max_hip_px_y = hip_px_y
                    reference_torso_length = torso_len

            if raw_elbow_left is not None and raw_elbow_right is not None:
                raw_elbow = (raw_elbow_left + raw_elbow_right) / 2
            elif raw_elbow_left is not None:
                raw_elbow = raw_elbow_left
            elif raw_elbow_right is not None:
                raw_elbow = raw_elbow_right
            else:
                continue

            smooth_elbow = elbow_filter.update(raw_elbow)

            completed = state_machine.update(smooth_elbow)
            if completed:
                completed_reps.append(completed)

        logger.info(f"Detected {len(completed_reps)} completed bench press reps.")

        per_frame_data = {
            "left_elbow_angles": frame_left_elbow_angles,
            "right_elbow_angles": frame_right_elbow_angles,
            "hip_px_y": frame_hip_px_y,
            "global_max_hip_px_y": global_max_hip_px_y,
            "reference_torso_length": reference_torso_length,
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
        """Apply biomechanical rules to a single bench press rep."""
        errors: list[str] = []
        deductions = 0.0

        start = rep.frame_start
        end = rep.frame_end

        rep_left = [a for a in per_frame_data["left_elbow_angles"][start:end] if a is not None]
        rep_right = [a for a in per_frame_data["right_elbow_angles"][start:end] if a is not None]

        max_elbow = 0.0
        if rep_left:
            max_elbow = max(max_elbow, max(rep_left))
        if rep_right:
            max_elbow = max(max_elbow, max(rep_right))

        if max_elbow < settings.BENCH_LOCKOUT_THRESHOLD:
            errors.append(
                f"Incomplete lockout: elbow reached only {max_elbow:.0f}° "
                f"(target: {settings.BENCH_LOCKOUT_THRESHOLD:.0f}°). Fully extend your arms at the top."
            )
            deductions += 25.0

        min_elbow = rep.min_elbow_angle if rep.min_elbow_angle is not None else 180.0
        if min_elbow > settings.BENCH_ROM_THRESHOLD:
            errors.append(
                f"Insufficient range of motion: elbow only reached {min_elbow:.0f}° "
                f"(target: below {settings.BENCH_ROM_THRESHOLD:.0f}°). Lower the bar closer to your chest."
            )
            deductions += 20.0

        rep_hip_px_y = per_frame_data["hip_px_y"][start:end]
        valid_rep_hip_px_y = [v for v in rep_hip_px_y if v is not None]
        
        hip_lift_delta = None
        if valid_rep_hip_px_y:
            min_hip_px_y = min(valid_rep_hip_px_y)
            global_max_hip_px_y = per_frame_data.get("global_max_hip_px_y", 0.0)
            ref_torso = per_frame_data.get("reference_torso_length", 1.0)
            
            if global_max_hip_px_y > 0 and ref_torso > 0:
                lift_px = max(0.0, global_max_hip_px_y - min_hip_px_y)
                hip_lift_delta = round(lift_px / ref_torso, 4)

        if hip_lift_delta is not None and hip_lift_delta > settings.BENCH_HIP_LIFT_TOLERANCE:
            errors.append(
                f"Hips lifted off the bench (lift: {hip_lift_delta:.3f}, "
                f"max allowed: {settings.BENCH_HIP_LIFT_TOLERANCE:.3f}). "
                "Keep your glutes on the bench throughout the movement."
            )
            deductions += 20.0

        descent_time_sec = rep.descent_frame_count / fps if fps > 0 else 0
        if rep.descent_frame_count > 0 and descent_time_sec < settings.BENCH_MIN_DESCENT_SECONDS:
            errors.append(
                f"Descent too fast ({descent_time_sec:.1f}s, "
                f"target > {settings.BENCH_MIN_DESCENT_SECONDS}s). Control the eccentric phase."
            )
            deductions += 15.0

        score = max(0.0, 100.0 - deductions)

        return RepReport(
            rep_number=rep.rep_number,
            score=round(score, 1),
            errors=errors,
            frame_start=rep.frame_start,
            frame_end=rep.frame_end,
            exercise_metrics={
                "min_elbow_angle": round(min_elbow, 1),
                "max_elbow_angle": round(max_elbow, 1),
                "hip_lift_delta": hip_lift_delta,
            },
        )

    def _aggregate_feedback(self, rep_reports: list[RepReport]) -> list[str]:
        """
        Summarize recurring errors across all reps into actionable tips.
        Only surfaces an error if it appears in ≥ 50% of reps.
        """
        if not rep_reports:
            return ["No complete reps detected. Film from the side of the bench, at bench height."]

        total = len(rep_reports)
        feedback: list[str] = []

        lockout_fails = sum(1 for r in rep_reports if any("lockout" in e.lower() for e in r.errors))
        rom_fails = sum(1 for r in rep_reports if any("range of motion" in e.lower() for e in r.errors))
        hip_fails = sum(1 for r in rep_reports if any("hips lifted" in e.lower() for e in r.errors))

        if lockout_fails / total >= 0.5:
            feedback.append("Work on full lockout — fully extend your arms at the top of each rep.")
        if rom_fails / total >= 0.5:
            feedback.append("Insufficient range of motion — lower the bar to touch or nearly touch your chest.")
        if hip_fails / total >= 0.5:
            feedback.append("Hips lifting off the bench — keep your glutes in contact with the bench at all times.")
        fast_descents = sum(1 for r in rep_reports if any("descent too fast" in e.lower() for e in r.errors))
        if fast_descents / total >= 0.5:
            feedback.append("Descent is too fast — control the eccentric phase (lowering the bar).")

        if not feedback:
            feedback.append("Good bench press form overall. Focus on consistency across all reps.")

        return feedback
