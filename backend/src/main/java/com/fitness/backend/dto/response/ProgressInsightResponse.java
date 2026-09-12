package com.fitness.backend.dto.response;

import java.util.List;

public record ProgressInsightResponse(
        String exerciseType,
        Integer totalSessions,
        String overallTrend,
        List<String> insights,
        List<TopError> topErrors) {
    
    public record TopError(
            String error,
            Integer occurrences,
            Float percentageOfSessions) {
    }
}
