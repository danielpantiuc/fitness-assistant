package com.fitness.backend.dto.response;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record AnalysisResultResponse(
        UUID videoId,
        String status,
        Integer totalReps,
        Float overallScore,
        List<String> feedback,
        List<RepDetailResponse> repDetails) {
    public record RepDetailResponse(
            Integer repNumber,
            Float score,
            List<String> errors,
            Map<String, Object> exerciseMetrics) {
    }
}
