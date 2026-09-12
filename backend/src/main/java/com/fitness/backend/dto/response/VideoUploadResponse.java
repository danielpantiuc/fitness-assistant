package com.fitness.backend.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;

public record VideoUploadResponse(
        UUID videoId,
        String exerciseType,
        String status,
        LocalDateTime createdAt) {
}
