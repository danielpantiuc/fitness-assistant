package com.fitness.backend.dto.response;

public record ClassificationResponse(
        String detectedExercise,
        double confidence,
        int framesAnalyzed
) {
}
