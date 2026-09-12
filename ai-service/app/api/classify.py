import os
import shutil
import tempfile
import cv2
import joblib
import mediapipe as mp
from collections import Counter
from fastapi import APIRouter, File, UploadFile, HTTPException

router = APIRouter()

MODEL_PATH = "app/models/exercise_classifier.pkl"
mp_pose = mp.solutions.pose
pose = mp_pose.Pose(static_image_mode=False, min_detection_confidence=0.5, min_tracking_confidence=0.5)

classifier = None
if os.path.exists(MODEL_PATH):
    classifier = joblib.load(MODEL_PATH)

@router.post("/classify")
async def classify_exercise(file: UploadFile = File(...)):
    global classifier
    
    if classifier is None:
        if os.path.exists(MODEL_PATH):
            classifier = joblib.load(MODEL_PATH)
        else:
            raise HTTPException(status_code=503, detail="Model not trained yet. Run train_model.py first.")

    if not file.filename.lower().endswith(('.mp4', '.mov', '.avi')):
        raise HTTPException(status_code=400, detail="Invalid video format. Must be mp4, mov, or avi.")

    try:
        fd, temp_path = tempfile.mkstemp(suffix=".mp4")
        with os.fdopen(fd, 'wb') as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save video: {str(e)}")

    predictions = []
    
    try:
        cap = cv2.VideoCapture(temp_path)
        frame_count = 0
        samples_taken = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
                
            frame_count += 1
            if frame_count % 5 != 0:
                continue
                
            image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(image)
            
            if results.pose_landmarks:
                features = []
                for landmark in results.pose_landmarks.landmark:
                    features.extend([landmark.x, landmark.y, landmark.z, landmark.visibility])
                
                pred = classifier.predict([features])[0]
                predictions.append(pred)
                samples_taken += 1
                
                if samples_taken >= 60:
                    break
                
        cap.release()
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    if not predictions:
        raise HTTPException(status_code=400, detail="No person detected in the video or video is too short.")

    most_common_class, votes = Counter(predictions).most_common(1)[0]
    confidence = round(votes / len(predictions), 2)

    return {
        "detected_exercise": most_common_class,
        "confidence": confidence,
        "frames_analyzed": len(predictions)
    }
