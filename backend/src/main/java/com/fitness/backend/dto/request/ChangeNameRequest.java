package com.fitness.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangeNameRequest(
        @NotBlank(message = "Username must not be blank")
        @Size(min = 2, max = 50, message = "Username must be between 2 and 50 characters")
        String username) {
}

