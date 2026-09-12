package com.fitness.backend.dto.response;

public record AuthResponse(
        String token,
        String email,
        String username) {
}
