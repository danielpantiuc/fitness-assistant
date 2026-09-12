import cv2
import mediapipe as mp
import os
import csv

mp_pose = mp.solutions.pose
pose = mp_pose.Pose(static_image_mode=False, min_detection_confidence=0.5, min_tracking_confidence=0.5)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET_DIR = os.path.join(BASE_DIR, "dataset")
OUTPUT_CSV = os.path.join(BASE_DIR, "data", "dataset.csv")

CLASSES = ["SQUAT", "BENCH", "DEADLIFT", "OTHER"]

def extract_features():
    with open(OUTPUT_CSV, mode='w', newline='') as f:
        writer = csv.writer(f)
        
        header = []
        for i in range(33):
            header.extend([f'x{i}', f'y{i}', f'z{i}', f'v{i}'])
        header.extend(['video_id', 'class'])
        writer.writerow(header)

        for class_name in CLASSES:
            class_dir = os.path.join(DATASET_DIR, class_name)
            if not os.path.exists(class_dir):
                print(f"Directory {class_dir} does not exist. Skipping.")
                continue
                
            for video_file in os.listdir(class_dir):
                if not video_file.endswith(('.mp4', '.mov', '.avi')):
                    continue
                    
                video_path = os.path.join(class_dir, video_file)
                print(f"Processing {video_path}...")
                cap = cv2.VideoCapture(video_path)
                
                frame_count = 0
                while cap.isOpened():
                    ret, frame = cap.read()
                    if not ret:
                        break
                        
                    frame_count += 1
                    if frame_count % 3 != 0:
                        continue
                        
                    image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    results = pose.process(image)
                    
                    if results.pose_landmarks:
                        row = []
                        for landmark in results.pose_landmarks.landmark:
                            row.extend([landmark.x, landmark.y, landmark.z, landmark.visibility])
                        row.extend([video_file, class_name])
                        writer.writerow(row)
                
                cap.release()
                
    print(f"Extraction complete! Saved to {OUTPUT_CSV}")

if __name__ == "__main__":
    extract_features()
