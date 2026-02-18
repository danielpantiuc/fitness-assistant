-- V1__init_schema.sql
-- Fitness Assistant — Initial Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS — Conturi utilizatori
-- ============================================
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(255),
    role          VARCHAR(20)  NOT NULL DEFAULT 'USER',
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. VIDEOS — Fișiere video încărcate
-- ============================================
CREATE TABLE videos (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_type    VARCHAR(50)  NOT NULL,
    file_path        VARCHAR(500) NOT NULL,
    status           VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    file_size_bytes  BIGINT,
    duration_seconds INT,
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_videos_user_id ON videos(user_id);
CREATE INDEX idx_videos_status  ON videos(status);

-- ============================================
-- 3. ANALYSIS_RESULTS — Rezultatul analizei AI
-- ============================================
CREATE TABLE analysis_results (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id           UUID UNIQUE NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    total_reps         INT,
    overall_score      REAL,
    feedback           JSONB,
    landmark_summary   JSONB,
    processing_time_ms INT,
    created_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- 4. REP_DETAILS — Detalii per repetare
-- ============================================
CREATE TABLE rep_details (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id    UUID        NOT NULL REFERENCES analysis_results(id) ON DELETE CASCADE,
    rep_number     INT         NOT NULL,
    score          REAL,
    phase          VARCHAR(30),
    errors         JSONB,
    min_knee_angle REAL,
    min_hip_angle  REAL,
    max_trunk_lean REAL
);

CREATE INDEX idx_rep_details_analysis_id ON rep_details(analysis_id);
