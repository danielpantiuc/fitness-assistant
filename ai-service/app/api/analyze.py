import os
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from loguru import logger

from app.core.pose_estimator import PoseEstimator
from app.core.biomechanics.squat import SquatAnalyzer
from app.core.biomechanics.bench_press import BenchPressAnalyzer
from app.core.biomechanics.deadlift import DeadliftAnalyzer
from app.core.biomechanics.base import AnalysisReport


router = APIRouter()


class AnalyzeRequest(BaseModel):
    video_id: str
    file_path: str
    exercise_type: str


class RepDetailResponse(BaseModel):
    rep_number: int
    score: float
    errors: list[str]
    min_knee_angle: float | None
    min_hip_angle: float | None
    max_trunk_lean: float | None
    max_pelvic_tilt: float | None = None
    max_knee_valgus: float | None = None
    max_heel_lift: float | None = None
    bar_position_offset: float | None = None
    descent_time_frames: int | None = None
    symmetry_diff: float | None = None
    exercise_metrics: dict | None = None


class AnalyzeResponse(BaseModel):
    video_id: str
    total_reps: int
    overall_score: float
    feedback: list[str]
    rep_details: list[RepDetailResponse]
    processing_time_ms: int


ANALYZERS = {
    "SQUAT": SquatAnalyzer,
    "BENCH_PRESS": BenchPressAnalyzer,
    "DEADLIFT": DeadliftAnalyzer,
}


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_video(request: AnalyzeRequest, http_request: Request):
    correlation_id = getattr(http_request.state, "correlation_id", "N/A")
    log = logger.bind(correlation_id=correlation_id, video_id=request.video_id)

    log.info(f"Analysis request received | exercise={request.exercise_type} | path={request.file_path}")

    exercise = request.exercise_type.upper()
    if exercise not in ANALYZERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported exercise type: '{exercise}'. Supported: {list(ANALYZERS.keys())}"
        )

    if not os.path.isfile(request.file_path):
        log.error(f"Video file not found: {request.file_path}")
        raise HTTPException(
            status_code=404,
            detail=f"Video file not found: {request.file_path}"
        )

    estimator = PoseEstimator()
    annotated_path = request.file_path.replace(".mp4", "_annotated.mp4").replace(".MOV", "_annotated.mp4").replace(".mov", "_annotated.mp4")
    if "_annotated.mp4" not in annotated_path:
        annotated_path = request.file_path + "_annotated.mp4"

    try:
        landmarks_per_frame, fps = estimator.process_video(
            request.file_path, 
            output_path=annotated_path,
            exercise_type=exercise
        )
    except Exception as e:
        log.error(f"Pose estimation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Pose estimation error: {str(e)}")
    finally:
        estimator.close()

    analyzer = ANALYZERS[exercise]()
    try:
        report: AnalysisReport = analyzer.analyze(landmarks_per_frame, fps=fps)
    except Exception as e:
        log.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

    log.info(f"Analysis complete | reps={report.total_reps} | score={report.overall_score} | ms={report.processing_time_ms}")

    return AnalyzeResponse(
        video_id=request.video_id,
        total_reps=report.total_reps,
        overall_score=report.overall_score,
        feedback=report.feedback,
        rep_details=[
            RepDetailResponse(
                rep_number=r.rep_number,
                score=r.score,
                errors=r.errors,
                min_knee_angle=r.min_knee_angle,
                min_hip_angle=r.min_hip_angle,
                max_trunk_lean=r.max_trunk_lean,
                max_pelvic_tilt=r.max_pelvic_tilt,
                max_knee_valgus=r.max_knee_valgus,
                max_heel_lift=r.max_heel_lift,
                bar_position_offset=r.bar_position_offset,
                descent_time_frames=r.descent_time_frames,
                symmetry_diff=r.symmetry_diff,
                exercise_metrics=r.exercise_metrics if r.exercise_metrics else None,
            )
            for r in report.rep_details
        ],
        processing_time_ms=report.processing_time_ms,
    )