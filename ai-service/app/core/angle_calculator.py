
import numpy as np
from typing import Optional

LandmarkPoint = dict[str, float]


def calculate_angle(a: LandmarkPoint, b: LandmarkPoint, c: LandmarkPoint, image_dims: Optional[dict] = None) -> float:
    """
    Calculate the angle at point B, formed by the segments A-B and C-B.
    Uses 2D projection (x, y). If image_dims is provided, restores the true aspect ratio.
    Returns angle in degrees [0, 180].
    """
    x_scale = image_dims["width"] if image_dims else 1.0
    y_scale = image_dims["height"] if image_dims else 1.0

    A = np.array([a["x"] * x_scale, a["y"] * y_scale])
    B = np.array([b["x"] * x_scale, b["y"] * y_scale])
    C = np.array([c["x"] * x_scale, c["y"] * y_scale])

    BA = A - B
    BC = C - B

    cross = abs(BA[0] * BC[1] - BA[1] * BC[0])
    dot = np.dot(BA, BC)

    angle = np.degrees(np.arctan2(cross, dot))
    return float(np.clip(angle, 0.0, 180.0))


def get_knee_angle(landmarks: dict, side: str = "LEFT") -> Optional[float]:
    """
    Angle at the knee joint: HIP → KNEE → ANKLE.
    ~170° = straight leg (standing), ~90° = parallel squat, <90° = deep squat.
    """
    try:
        hip = landmarks[f"{side}_HIP"]
        knee = landmarks[f"{side}_KNEE"]
        ankle = landmarks[f"{side}_ANKLE"]
        dims = landmarks.get("_IMAGE_DIMENSIONS")
        return calculate_angle(hip, knee, ankle, dims)
    except KeyError:
        return None


def get_hip_angle(landmarks: dict, side: str = "LEFT") -> Optional[float]:
    """
    Angle at the hip joint: SHOULDER → HIP → KNEE.
    ~170° = upright torso, ~90° = parallel torso to thighs.
    """
    try:
        shoulder = landmarks[f"{side}_SHOULDER"]
        hip = landmarks[f"{side}_HIP"]
        knee = landmarks[f"{side}_KNEE"]
        dims = landmarks.get("_IMAGE_DIMENSIONS")
        return calculate_angle(shoulder, hip, knee, dims)
    except KeyError:
        return None


def get_trunk_lean_angle(landmarks: dict) -> Optional[float]:
    """
    Angle between the trunk (shoulder → hip) and the vertical axis.
    0° = perfectly upright, 90° = horizontal (lying down).
    Uses the midpoints of left and right shoulders/hips for robustness.
    """
    try:
        shoulder_mid = {
            "x": (landmarks["LEFT_SHOULDER"]["x"] + landmarks["RIGHT_SHOULDER"]["x"]) / 2,
            "y": (landmarks["LEFT_SHOULDER"]["y"] + landmarks["RIGHT_SHOULDER"]["y"]) / 2,
        }
        hip_mid = {
            "x": (landmarks["LEFT_HIP"]["x"] + landmarks["RIGHT_HIP"]["x"]) / 2,
            "y": (landmarks["LEFT_HIP"]["y"] + landmarks["RIGHT_HIP"]["y"]) / 2,
        }

        dims = landmarks.get("_IMAGE_DIMENSIONS")
        x_scale = dims["width"] if dims else 1.0
        y_scale = dims["height"] if dims else 1.0

        trunk_vec = np.array([
            (shoulder_mid["x"] - hip_mid["x"]) * x_scale,
            (shoulder_mid["y"] - hip_mid["y"]) * y_scale,
            ])

        vertical_vec = np.array([0, -1 * y_scale])

        cos_angle = np.dot(trunk_vec, vertical_vec) / (np.linalg.norm(trunk_vec) * np.linalg.norm(vertical_vec) + 1e-6)
        angle = np.degrees(np.arccos(np.clip(cos_angle, -1.0, 1.0)))
        return float(angle)
    except KeyError:
        return None


def get_knee_toe_offset(landmarks: dict, side: str = "LEFT") -> Optional[float]:
    """
    Horizontal distance (X-axis) between knee and foot index (toe).
    Positive = knee is in FRONT of toes (knee over toe).
    Negative = knee is BEHIND toes (good position).

    Note: In normalized coords, x increases left→right.
    This assumes a side-view camera.
    """
    try:
        knee_x = landmarks[f"{side}_KNEE"]["x"]
        toe_x = landmarks[f"{side}_FOOT_INDEX"]["x"]
        return float(knee_x - toe_x)
    except KeyError:
        return None


def get_pelvic_tilt_angle(landmarks: dict) -> Optional[float]:
    """
    Angle of the pelvis relative to horizontal.
    Uses the line between LEFT_HIP and RIGHT_HIP.
    A sudden change in this angle at the bottom of a squat = butt wink.
    Returns angle in degrees (0° = perfectly horizontal pelvis).
    """
    try:
        left_hip = landmarks["LEFT_HIP"]
        right_hip = landmarks["RIGHT_HIP"]

        dims = landmarks.get("_IMAGE_DIMENSIONS")
        x_scale = dims["width"] if dims else 1.0
        y_scale = dims["height"] if dims else 1.0

        pelvic_vec = np.array([
            (right_hip["x"] - left_hip["x"]) * x_scale,
            (right_hip["y"] - left_hip["y"]) * y_scale,
        ])

        horizontal = np.array([1 * x_scale, 0])

        cos_angle = np.dot(pelvic_vec, horizontal) / (np.linalg.norm(pelvic_vec) * np.linalg.norm(horizontal) + 1e-6)
        angle = np.degrees(np.arccos(np.clip(cos_angle, -1.0, 1.0)))
        return float(angle)
    except KeyError:
        return None


def get_knee_valgus_indicator(landmarks: dict, side: str = "LEFT") -> Optional[float]:
    """
    Horizontal offset between knee and ankle on the X-axis.
    Negative = knee is INSIDE ankle (valgus / knee caving in).
    Positive = knee is OUTSIDE ankle (varus / knee pushing out).

    Best detected from a frontal camera view.
    """
    try:
        knee_x = landmarks[f"{side}_KNEE"]["x"]
        ankle_x = landmarks[f"{side}_ANKLE"]["x"]

        if side == "LEFT":
            return float(ankle_x - knee_x)
        else:
            return float(knee_x - ankle_x)
    except KeyError:
        return None


def get_heel_lift_indicator(landmarks: dict, side: str = "LEFT") -> Optional[float]:
    """
    Vertical distance between heel and toe (foot index), normalized by the person's
    body height (shoulder to ankle) to be robust against camera zoom and distance.
    Positive = heel is ABOVE toe (heel lifting off ground).
    Returns lift as a fraction of body height (e.g., 0.03 = 3% of body length).
    """
    try:
        heel = landmarks[f"{side}_HEEL"]
        toe = landmarks[f"{side}_FOOT_INDEX"]
        shoulder = landmarks[f"{side}_SHOULDER"]
        ankle = landmarks[f"{side}_ANKLE"]

        dims = landmarks.get("_IMAGE_DIMENSIONS")
        x_scale = dims["width"] if dims else 1.0
        y_scale = dims["height"] if dims else 1.0

        body_vec = np.array([
            (shoulder["x"] - ankle["x"]) * x_scale,
            (shoulder["y"] - ankle["y"]) * y_scale
        ])
        body_length = np.linalg.norm(body_vec)

        if body_length < 1e-6:
            return 0.0

        heel_y = heel["y"] * y_scale
        toe_y = toe["y"] * y_scale
        lift_distance = toe_y - heel_y
        
        return float(lift_distance / body_length)
    except KeyError:
        return None


def get_bar_position_offset(landmarks: dict) -> Optional[float]:
    """
    Distance between wrist midpoint and shoulder midpoint.
    For a proper back squat, wrists should be close to shoulders (gripping the bar on upper back).
    A large offset suggests the bar is misplaced or arms are too far from the body.

    Only returns a value if wrist landmarks have sufficient visibility.
    """
    try:
        left_wrist = landmarks["LEFT_WRIST"]
        right_wrist = landmarks["RIGHT_WRIST"]

        min_vis = min(left_wrist.get("visibility", 0), right_wrist.get("visibility", 0))
        if min_vis < 0.6:
            return None

        dims = landmarks.get("_IMAGE_DIMENSIONS")
        x_scale = dims["width"] if dims else 1.0
        y_scale = dims["height"] if dims else 1.0

        shoulder_mid = np.array([
            ((landmarks["LEFT_SHOULDER"]["x"] + landmarks["RIGHT_SHOULDER"]["x"]) / 2) * x_scale,
            ((landmarks["LEFT_SHOULDER"]["y"] + landmarks["RIGHT_SHOULDER"]["y"]) / 2) * y_scale,
        ])
        hip_mid = np.array([
            ((landmarks["LEFT_HIP"]["x"] + landmarks["RIGHT_HIP"]["x"]) / 2) * x_scale,
            ((landmarks["LEFT_HIP"]["y"] + landmarks["RIGHT_HIP"]["y"]) / 2) * y_scale,
        ])
        torso_length = np.linalg.norm(shoulder_mid - hip_mid)
        if torso_length < 1e-6:
            return 0.0

        wrist_mid = np.array([
            ((left_wrist["x"] + right_wrist["x"]) / 2) * x_scale,
            ((left_wrist["y"] + right_wrist["y"]) / 2) * y_scale,
        ])

        distance = float(np.linalg.norm(wrist_mid - shoulder_mid))
        return distance / torso_length
    except KeyError:
        return None




def get_elbow_angle(landmarks: dict, side: str = "LEFT") -> Optional[float]:
    """
    Angle at the elbow joint: SHOULDER → ELBOW → WRIST.
    ~170° = fully extended (lockout), ~90° = bar at chest level.
    Used primarily for bench press rep detection and lockout analysis.
    """
    try:
        shoulder = landmarks[f"{side}_SHOULDER"]
        elbow = landmarks[f"{side}_ELBOW"]
        wrist = landmarks[f"{side}_WRIST"]
        dims = landmarks.get("_IMAGE_DIMENSIONS")
        return calculate_angle(shoulder, elbow, wrist, dims)
    except KeyError:
        return None


def get_back_arch_indicator(landmarks: dict) -> Optional[float]:
    """
    Vertical distance between shoulder midpoint and hip midpoint (Y-axis).
    In bench press, a large vertical gap indicates excessive back arch.
    In image coords: y increases downward.
    Returns the absolute vertical offset (normalized).
    A higher value = more arching.
    """
    try:
        shoulder_mid_y = (landmarks["LEFT_SHOULDER"]["y"] + landmarks["RIGHT_SHOULDER"]["y"]) / 2
        hip_mid_y = (landmarks["LEFT_HIP"]["y"] + landmarks["RIGHT_HIP"]["y"]) / 2

        offset = abs(hip_mid_y - shoulder_mid_y)
        return float(offset)
    except KeyError:
        return None




def get_bar_tracking_data(landmarks: dict) -> Optional[dict]:
    """
    Extracts the horizontal (X) position of the wrists and the torso length.
    Used to track the bar's horizontal drift over the course of a deadlift repetition.
    Returns a dict with 'wrist_x' and 'torso_length' in corrected pixels.
    """
    try:
        left_wrist = landmarks["LEFT_WRIST"]
        right_wrist = landmarks["RIGHT_WRIST"]

        min_vis = min(left_wrist.get("visibility", 0), right_wrist.get("visibility", 0))
        if min_vis < 0.5:
            return None

        dims = landmarks.get("_IMAGE_DIMENSIONS")
        x_scale = dims["width"] if dims else 1.0
        y_scale = dims["height"] if dims else 1.0

        shoulder_mid = np.array([
            ((landmarks["LEFT_SHOULDER"]["x"] + landmarks["RIGHT_SHOULDER"]["x"]) / 2) * x_scale,
            ((landmarks["LEFT_SHOULDER"]["y"] + landmarks["RIGHT_SHOULDER"]["y"]) / 2) * y_scale,
        ])
        hip_mid = np.array([
            ((landmarks["LEFT_HIP"]["x"] + landmarks["RIGHT_HIP"]["x"]) / 2) * x_scale,
            ((landmarks["LEFT_HIP"]["y"] + landmarks["RIGHT_HIP"]["y"]) / 2) * y_scale,
        ])
        torso_length = np.linalg.norm(shoulder_mid - hip_mid)
        if torso_length < 1e-6:
            return 0.0

        wrist_mid_x = ((left_wrist["x"] + right_wrist["x"]) / 2) * x_scale

        return {
            "wrist_x": float(wrist_mid_x),
            "torso_length": float(torso_length)
        }
    except KeyError:
        return None
