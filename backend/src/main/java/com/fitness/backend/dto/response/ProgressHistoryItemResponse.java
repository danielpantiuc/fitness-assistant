package com.fitness.backend.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;

public record ProgressHistoryItemResponse(
        UUID videoId,
        String exerciseType,
        String status,
        Float overallScore,
        Integer totalReps,
        LocalDateTime analyzedAt) {
}
