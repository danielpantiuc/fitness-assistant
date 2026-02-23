from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class AnalyzeRequest(BaseModel):
    video_id: str
    file_path: str
    exercise_type: str  # SQUAT, BENCH_PRESS, DEADLIFT

@router.post("/analyze")
async def analyze_video(request: AnalyzeRequest):
    # TODO: implement in Phase 8
    return {"status": "received", "video_id": request.video_id}