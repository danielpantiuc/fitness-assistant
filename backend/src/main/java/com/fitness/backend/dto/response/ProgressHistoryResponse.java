package com.fitness.backend.dto.response;

import java.util.List;

public record ProgressHistoryResponse(
        List<ProgressHistoryItemResponse> sessions,
        Integer totalCount,
        Integer page,
        Integer size,
        Integer totalPages) {
}
