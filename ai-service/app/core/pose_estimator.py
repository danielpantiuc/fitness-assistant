import cv2
import mediapipe as mp
from typing import Optional
from loguru import logger
from app.config import settings
RELEVANT_LANDMARKS = {
    "LEFT_ELBOW": 13,
    "RIGHT_ELBOW": 14,
    "LEFT_WRIST": 15,
    "RIGHT_WRIST": 16,
    "LEFT_SHOULDER": 11,
    "RIGHT_SHOULDER": 12,
    "LEFT_HIP": 23,
    "RIGHT_HIP": 24,
    "LEFT_KNEE": 25,
    "RIGHT_KNEE": 26,
    "LEFT_ANKLE": 27,
    "RIGHT_ANKLE": 28,
    "LEFT_HEEL": 29,
    "RIGHT_HEEL": 30,
    "LEFT_FOOT_INDEX": 31,
    "RIGHT_FOOT_INDEX": 32,
}
LandmarkDict = dict[str, dict[str, float]]
class PoseEstimator:
    """
    Wraps MediaPipe Pose for video-based landmark extraction.
    """
    def __init__(self):
        self._mp_pose = mp.solutions.pose
        self._pose = self._mp_pose.Pose(
            static_image_mode=False,          # False = video mode (uses tracking)
            model_complexity=1,               # 0=lite, 1=full, 2=heavy
            min_detection_confidence=settings.MIN_DETECTION_CONFIDENCE,
            min_tracking_confidence=settings.MIN_TRACKING_CONFIDENCE,
        )
        self._heel_lift_frames = 0  # Debug tracker for consecutive heel lift frames
        self._descent_frames = 0
        self._last_knee_angle = None
        self._last_hip_angle = None
        self._last_elbow_angle = None
        self._max_hip_y_lying = 0.0
        self._ref_torso_length = 0.0
        self._rep_count = 0
        self._in_rep = False
        logger.debug("PoseEstimator initialized with MediaPipe Pose.")
    def extract_landmarks(self, frame_rgb: "np.ndarray") -> Optional[LandmarkDict]:
        """
        Process a single RGB frame and return relevant landmarks.
        Returns None if pose is not detected.
        """
        results = self._pose.process(frame_rgb)
        if not results.pose_landmarks:
            return None
        landmarks: LandmarkDict = {}
        for name, idx in RELEVANT_LANDMARKS.items():
            lm = results.pose_landmarks.landmark[idx]
            landmarks[name] = {
                "x": lm.x,
                "y": lm.y,
                "z": lm.z,
                "visibility": lm.visibility,
            }
        return landmarks
    def _open_video(self, video_path: str) -> tuple[cv2.VideoCapture, int, int, int, float]:
        """Opens the video, validates it, and returns the capture object and metadata."""
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video file: {video_path}")
            
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        
        return cap, width, height, total_frames, fps

    def _create_video_writer(self, output_path: str, width: int, height: int, fps: float) -> cv2.VideoWriter:
        """Creates an OpenCV VideoWriter to save the processed clip with MediaPipe overlays."""
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        return cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    def _process_single_frame(self, frame_bgr: "np.ndarray") -> tuple["Any", Optional[LandmarkDict]]:
        """Converts to RGB, uses MediaPipe for analysis, and returns the relevant landmarks."""
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        results = self._pose.process(frame_rgb)
        
        if not results.pose_landmarks:
            return results, None
            
        landmarks: LandmarkDict = {}
        for name, idx in RELEVANT_LANDMARKS.items():
            lm = results.pose_landmarks.landmark[idx]
            landmarks[name] = {"x": lm.x, "y": lm.y, "z": lm.z, "visibility": lm.visibility}
            
        landmarks["_IMAGE_DIMENSIONS"] = {
            "width": float(frame_bgr.shape[1]),
            "height": float(frame_bgr.shape[0])
        }
            
        return results, landmarks

    def _draw_and_write(self, writer: cv2.VideoWriter, frame_bgr: "np.ndarray", results: "Any", landmarks: Optional[LandmarkDict], exercise_type: str) -> None:
        """Draws the pose skeleton and HUD on the frame and writes it to the output stream."""
        if results.pose_landmarks:
            mp_drawing = mp.solutions.drawing_utils
            
            landmark_spec = mp_drawing.DrawingSpec(color=(220, 50, 220), thickness=2, circle_radius=5)  # Purple nodes
            connection_spec = mp_drawing.DrawingSpec(color=(255, 200, 0), thickness=3) # Vibrant blue/cyan connections (BGR format)

            mp_drawing.draw_landmarks(
                image=frame_bgr,
                landmark_list=results.pose_landmarks,
                connections=self._mp_pose.POSE_CONNECTIONS,
                landmark_drawing_spec=landmark_spec,
                connection_drawing_spec=connection_spec
            )
            
        if landmarks:
            from app.core.angle_calculator import get_knee_angle, get_hip_angle, get_trunk_lean_angle, get_heel_lift_indicator, get_elbow_angle
            from app.config import settings
            
            l_vis = sum(landmarks.get(k, {}).get("visibility", 0) for k in ["LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"])
            r_vis = sum(landmarks.get(k, {}).get("visibility", 0) for k in ["RIGHT_HIP", "RIGHT_KNEE", "RIGHT_ANKLE"])
            side = "LEFT" if l_vis >= r_vis else "RIGHT"

            metrics_to_draw = []

            knee_angle = get_knee_angle(landmarks, side=side)
            hip_angle = get_hip_angle(landmarks, side=side)
            lean_angle = get_trunk_lean_angle(landmarks)

            if exercise_type == "SQUAT":
                heel_lift = get_heel_lift_indicator(landmarks, side=side)

                if heel_lift is not None and heel_lift > settings.HEEL_LIFT_TOLERANCE:
                    self._heel_lift_frames += 1
                else:
                    self._heel_lift_frames = 0
                
                if knee_angle is not None:
                    if self._last_knee_angle is not None:
                        if knee_angle < self._last_knee_angle and knee_angle < settings.DESCENDING_KNEE_ANGLE:
                            self._descent_frames += 1
                        elif knee_angle > self._last_knee_angle + 2.0:
                            self._descent_frames = 0
                    
                    if knee_angle < settings.BOTTOM_KNEE_ANGLE:
                        self._in_rep = True
                    elif knee_angle > settings.STANDING_RETURN_ANGLE and self._in_rep:
                        self._rep_count += 1
                        self._in_rep = False
                        
                    self._last_knee_angle = knee_angle
                
                if knee_angle is not None: metrics_to_draw.append(("Knee", f"{knee_angle:.1f} deg", (255,255,255)))
                if hip_angle is not None: metrics_to_draw.append(("Hip", f"{hip_angle:.1f} deg", (255,255,255)))
                if lean_angle is not None: metrics_to_draw.append(("Lean", f"{lean_angle:.1f} deg", (255,255,255)))
                if heel_lift is not None:
                    color = (0, 0, 255) if heel_lift > settings.HEEL_LIFT_TOLERANCE else (0, 255, 0)
                    metrics_to_draw.append(("Heel Lift", "YES" if heel_lift > settings.HEEL_LIFT_TOLERANCE else "NO", color))
                metrics_to_draw.append(("Descent Frms", f"{self._descent_frames}", (255,255,255)))

            elif exercise_type == "BENCH_PRESS":
                elbow_angle = get_elbow_angle(landmarks, side=side)
                
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
                
                if hip_px_y is not None and lean_angle is not None and lean_angle > 70 and torso_len is not None and torso_len > 0:
                    if hip_px_y > self._max_hip_y_lying:
                        self._max_hip_y_lying = hip_px_y
                        self._ref_torso_length = torso_len

                current_hip_lift = 0.0
                if self._max_hip_y_lying > 0 and hip_px_y is not None and self._ref_torso_length > 0:
                    lift_px = max(0.0, self._max_hip_y_lying - hip_px_y)
                    current_hip_lift = lift_px / self._ref_torso_length
                
                if current_hip_lift > settings.BENCH_HIP_LIFT_TOLERANCE:
                    lift_color = (0, 0, 255)
                else:
                    lift_color = (0, 255, 0)
                
                if elbow_angle is not None:
                    if self._last_elbow_angle is not None:
                        if elbow_angle < self._last_elbow_angle and elbow_angle < settings.BENCH_LOCKOUT_THRESHOLD:
                            self._descent_frames += 1
                        elif elbow_angle > self._last_elbow_angle + 2.0:
                            self._descent_frames = 0
                            
                    if elbow_angle < settings.BENCH_BOTTOM_ANGLE:
                        self._in_rep = True
                    elif elbow_angle > settings.BENCH_STANDING_RETURN_ANGLE and self._in_rep:
                        self._rep_count += 1
                        self._in_rep = False
                        
                    self._last_elbow_angle = elbow_angle

                if elbow_angle is not None: metrics_to_draw.append(("Elbow", f"{elbow_angle:.1f} deg", (255,255,255)))
                metrics_to_draw.append(("Descent Frms", f"{self._descent_frames}", (255,255,255)))
                metrics_to_draw.append(("Hip Lift", f"{current_hip_lift:.3f}", lift_color))

            elif exercise_type == "DEADLIFT":
                if hip_angle is not None:
                    if hip_angle > settings.DL_LOCKOUT_RETURN_ANGLE and not self._in_rep:
                        self._in_rep = True
                    elif hip_angle < settings.DL_BOTTOM_ANGLE and self._in_rep:
                        self._rep_count += 1
                        self._in_rep = False
                        
                    self._last_hip_angle = hip_angle

                if hip_angle is not None: metrics_to_draw.append(("Hip", f"{hip_angle:.1f} deg", (255,255,255)))
                if knee_angle is not None: metrics_to_draw.append(("Knee", f"{knee_angle:.1f} deg", (255,255,255)))
                if lean_angle is not None: metrics_to_draw.append(("Lean", f"{lean_angle:.1f} deg", (255,255,255)))
            
            overlay = frame_bgr.copy()
            hud_w = 380
            hud_h = 110 + (len(metrics_to_draw) * 40)
            cv2.rectangle(overlay, (20, 20), (20 + hud_w, 20 + hud_h), (25, 25, 30), -1)
            cv2.addWeighted(overlay, 0.7, frame_bgr, 0.3, 0, frame_bgr)
            
            cv2.rectangle(frame_bgr, (20, 20), (20 + hud_w, 20 + hud_h), (200, 200, 200), 2)

            text_x = 40
            text_y = 65
            font = cv2.FONT_HERSHEY_SIMPLEX
            
            cv2.putText(frame_bgr, f"SIDE: {side}   REPS: {self._rep_count}", (text_x, text_y), font, 0.8, (255, 255, 255), 2, cv2.LINE_AA)
            text_y += 45
            
            cv2.putText(frame_bgr, f"EXERCISE: {exercise_type}", (text_x, text_y), font, 0.7, (0, 200, 255), 2, cv2.LINE_AA)
            text_y += 40
            
            for label, value, color in metrics_to_draw:
                cv2.putText(frame_bgr, f"{label}:", (text_x, text_y), font, 0.7, (200, 200, 200), 2, cv2.LINE_AA)
                cv2.putText(frame_bgr, value, (text_x + 160, text_y), font, 0.75, color, 2, cv2.LINE_AA)
                text_y += 40
                
        writer.write(frame_bgr)

    def process_video(self, video_path: str, output_path: Optional[str] = None, exercise_type: str = "SQUAT") -> tuple[list[Optional[LandmarkDict]], float]:
        """
        Extract landmarks for every frame in a video file.
        Returns a tuple:
          - A list where each element is either LandmarkDict or None
          - The FPS of the video as a float
        """
        cap, width, height, total_frames, fps = self._open_video(video_path)
        
        writer = None
        if output_path:
            writer = self._create_video_writer(output_path, width, height, fps)

        logger.info(f"Processing video: {video_path} | {total_frames} frames @ {fps:.1f} fps")
        
        all_landmarks: list[Optional[LandmarkDict]] = []
        while True:
            success, frame_bgr = cap.read()
            if not success:
                break

            results, landmarks = self._process_single_frame(frame_bgr)
            all_landmarks.append(landmarks)
            
            if writer is not None:
                self._draw_and_write(writer, frame_bgr, results, landmarks, exercise_type)

        cap.release()
        if writer is not None:
            writer.release()
            
        valid_count = sum(1 for lm in all_landmarks if lm is not None)
        valid_ratio = valid_count / len(all_landmarks) if all_landmarks else 0
        logger.info(f"Landmark extraction done: {valid_count}/{len(all_landmarks)} valid frames ({valid_ratio:.1%}) @ {fps:.1f} fps")
        
        return all_landmarks, fps
    def close(self):
        """Release MediaPipe resources."""
        self._pose.close()