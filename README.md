# SBD Assist (AI Powerlifting Form Analyzer)

**SBD Assist** is a comprehensive, AI-powered mobile application built to help powerlifters and fitness enthusiasts analyze and improve their form for the "Big Three" lifts: **Squat, Bench Press, and Deadlift (SBD)**.

By leveraging advanced Computer Vision algorithms and Machine Learning, the app tracks biomechanical movements from uploaded videos, counts repetitions, draws a real-time Heads-Up Display (HUD) overlay, and provides actionable feedback on form mistakes.

---

## Key Features

* **Intelligent Video Analysis**: Upload a video of your set from the gallery, and the AI will analyze it frame by frame.
* **Rep Counting & State Tracking**: Automatically tracks the states of the lift (Standing, Descending, Bottom, Ascending, Lockout) and counts completed reps.
* **Biomechanical Feedback**:
  * **Squat**: Tracks knee angles, detects heel lifts, and monitors descent stability.
  * **Bench Press**: Tracks elbow angles, enforces descent tempo limits (detects if the bar drops too fast).
  * **Deadlift**: Tracks hip angles and lockout mechanics.
* **Heads-Up Display (HUD) Video Generation**: Generates a new version of your video with an embedded OSD (On-Screen Display) showing real-time angles, rep counts, and alerts.
* **Progress Tracking**: Tracks your workout history and visualizes your progress over time.
* **Full Authentication Flow**: Secure user registration, login, profile management, and password updates.

---

## Technical Architecture

The project is built using a modern, scalable microservices architecture divided into three main components:

### 1. Mobile Frontend (React Native / Expo)
* **Framework**: React Native with Expo (`expo-router` for navigation).
* **Language**: TypeScript.
* **Media Handling**: `expo-image-picker` for gallery access and the modern `expo-video` for seamless, native video playback.
* **Design**: Custom, dynamic CSS-in-JS UI with dark mode, glassmorphism elements, and smooth micro-animations.

### 2. Backend API (Java / Spring Boot)
* **Framework**: Spring Boot 3 (Java 17).
* **Database**: PostgreSQL with Flyway for automated database migrations.
* **Security**: JWT-based stateless authentication (`Spring Security`).
* **Purpose**: Manages user accounts, stores video metadata, acts as a secure gateway, and serves workout history/trends.

### 3. AI / Computer Vision Service (Python)
* **Framework**: FastAPI for high-performance Python endpoints.
* **AI & Vision**:
  * **MediaPipe Pose**: Extracts 33 3D body landmarks per frame.
  * **OpenCV (`cv2`)**: Processes video frames and draws the custom HUD overlay.
  * **Scikit-Learn**: Machine Learning model (Random Forest) trained on a custom dataset (`dataset.csv`) to classify the exercise type automatically.
* **Logic**: Custom state machines for each lift type to track transition points (e.g., anatomical limits, eccentric/concentric phases).

---

## How to Run Locally

### Prerequisites
* Docker & Docker Compose
* Node.js & npm
* JDK 17 (if running backend outside of Docker)
* Python 3.12 (if running AI service outside of Docker)

### 1. Start the Backend & AI Service (Docker)
The easiest way to run the databases and services is via Docker.
```bash
docker compose up -d
```
*This will spin up the PostgreSQL database, the Java Spring Boot Backend, and the Python FastAPI AI Service.*

### 2. Start the Mobile App
Open a new terminal, navigate to the `mobile` directory, and start the Metro Bundler:
```bash
cd mobile
npm install
npx expo start -c
```
*Scan the generated QR code with the Expo Go app on your physical device, or press `i` / `a` to run it on an iOS Simulator or Android Emulator.*

---

## Project Structure

* `/mobile` - React Native Expo frontend application.
* `/backend` - Java Spring Boot application handling business logic and auth.
* `/ai-service` - Python FastAPI service handling computer vision, video rendering, and ML.
  * `/ai-service/data` - Contains the dataset (`dataset.csv`) and confusion matrix generated during ML model training.
* `docker-compose.yml` - Orchestrates the backend and AI containers.

---

*Project developed for Academic / Thesis purposes.*
