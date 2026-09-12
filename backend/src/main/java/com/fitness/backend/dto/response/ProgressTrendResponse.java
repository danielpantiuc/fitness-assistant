package com.fitness.backend.dto.response;

import java.time.LocalDateTime;
import java.util.List;

public record ProgressTrendResponse(
        String exerciseType,
        Integer totalSessions,
        Float bestScore,
        Float averageScore,
        Float averageLastN,
        Float averagePreviousN,
        Float scoreDelta,
        Float consistency,
        String trend,
        List<ScorePoint> scorePoints) {
    
    public record ScorePoint(
            LocalDateTime timestamp,
            Float score,
            Integer reps) {
    }
}
