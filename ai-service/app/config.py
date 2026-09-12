
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Centralized configuration for the AI service.
    All values can be overridden via environment variables.
    """

    MIN_DETECTION_CONFIDENCE: float = 0.5
    MIN_TRACKING_CONFIDENCE: float = 0.5

    SMOOTHING_WINDOW_SIZE: int = 5  # Moving average window (in frames)

    STANDING_KNEE_ANGLE: float = 160.0    # Above this = standing
    DESCENDING_KNEE_ANGLE: float = 150.0  # Below this = started descending
    BOTTOM_KNEE_ANGLE: float = 125.0      # Below this = rep is counted
    ASCENDING_KNEE_ANGLE: float = 130.0   # Above this (+hysteresis) = ascending from bottom
    STANDING_RETURN_ANGLE: float = 155.0  # Above this = rep completed

    HYSTERESIS_BUFFER: float = 5.0       # Prevents oscillation between states
    KNEE_ANGLE_MIN_VALID: float = 30.0   # Below this = MediaPipe noise (anatomically impossible)

    DEPTH_THRESHOLD: float = 95.0         # Knee angle must go below this for "deep enough"
    TRUNK_LEAN_MAX: float = 46.0           # Max forward lean angle (degrees) — strict limit for excessive lean

    HEEL_LIFT_TOLERANCE: float = 0.07      # Heel rises above toe (> 7% of body length)
    HEEL_LIFT_MIN_SECONDS: float = 0.3     # Min consecutive time for heel lift to count (noise filter)
    SQUAT_MIN_DESCENT_SECONDS: float = 0.8 # Min time for controlled descent (~0.8s)
    HIPS_SHOOTING_UP_TOLERANCE: float = 5.0 # Max degrees trunk can lean forward during ascent compared to bottom

    SYMMETRY_ANGLE_DIFF_MAX: float = 20.0  # Kept for reference, currently unused

    BENCH_LOCKOUT_ANGLE: float = 160.0       # Above this = lockout (arms extended)
    BENCH_DESCENDING_ANGLE: float = 150.0    # Below this = started descending
    BENCH_BOTTOM_ANGLE: float = 110.0        # Below this = at bottom (bar at chest)
    BENCH_ASCENDING_ANGLE: float = 110.0     # Above this = ascending from bottom
    BENCH_STANDING_RETURN_ANGLE: float = 155.0  # Above this = completed rep (lockout)
    BENCH_HYSTERESIS: float = 5.0

    BENCH_ROM_THRESHOLD: float = 95.0        # Elbow angle must go below this for full ROM
    BENCH_LOCKOUT_THRESHOLD: float = 160.0   # Elbow angle must reach this at top for lockout
    BENCH_HIP_LIFT_TOLERANCE: float = 0.1    # Max hip Y-delta from start position (normalized)
    BENCH_MIN_DESCENT_SECONDS: float = 0.5    # Min time for controlled descent (~0.8s)

    DL_STANDING_ANGLE: float = 160.0         # Above this = standing
    DL_DESCENDING_ANGLE: float = 150.0       # Below this = started descending
    DL_BOTTOM_ANGLE: float = 100.0           # Below this = at bottom (bent over)
    DL_ASCENDING_ANGLE: float = 100.0        # Above this = ascending
    DL_LOCKOUT_RETURN_ANGLE: float = 155.0   # Above this = completed rep
    DL_HYSTERESIS: float = 5.0

    DL_LOCKOUT_HIP_THRESHOLD: float = 160.0  # Hip angle must reach this at top (realistic full lockout)
    DL_TRUNK_LEAN_MAX: float = 55.0          # Kept for reference — NOT used in evaluation (see deadlift.py)
    DL_BAR_DISTANCE_TOLERANCE: float = 0.15  # Max wrist-hip X offset (> 15% of torso length)
    DL_MIN_DESCENT_SECONDS: float = 0.5      # Min time for controlled descent (~0.5s)
    DL_SQUAT_STYLE_KNEE_THRESHOLD: float = 80.0  # Knee angle below this at bottom = squat-style deadlift

    MIN_VALID_FRAMES_RATIO: float = 0.6  # Need 60% valid frames minimum

    class Config:
        env_prefix = "AI_"  # e.g., AI_BOTTOM_KNEE_ANGLE=95


settings = Settings()
