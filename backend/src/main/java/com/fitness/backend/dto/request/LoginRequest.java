package com.fitness.backend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
                @NotBlank(message = "Email address is required") @Email(message = "Please enter a valid email address") String email,
                @NotBlank(message = "Password is required") String password) {
}
