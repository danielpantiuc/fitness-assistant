package com.fitness.backend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "Email address is required!")
        @Email(message = "Please enter a valid email address!")
        String email,
        @NotBlank(message = "Password is required!")
        @Size(min = 6, message = "Password must be at least 6 characters!")
        String password,
        @NotBlank(message = "Username is required!")
        @Size(min = 2, max = 50, message = "Username must be between 2 and 50 characters!")
        String username) {
}
