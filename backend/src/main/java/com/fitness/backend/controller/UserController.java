package com.fitness.backend.controller;

import com.fitness.backend.dto.request.ChangeNameRequest;
import com.fitness.backend.dto.request.ChangePasswordRequest;
import com.fitness.backend.dto.response.UserProfileResponse;
import com.fitness.backend.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users/me")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /**
     * GET /api/v1/users/me
     * Returns the current user's profile info.
     */
    @GetMapping
    public ResponseEntity<UserProfileResponse> getProfile(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(userService.getProfile(userDetails.getUsername()));
    }

    /**
     * PATCH /api/v1/users/me/name
     * Update the current user's display name.
     */
    @PatchMapping("/name")
    public ResponseEntity<UserProfileResponse> changeName(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ChangeNameRequest request) {
        return ResponseEntity.ok(userService.changeName(userDetails.getUsername(), request));
    }

    /**
     * PATCH /api/v1/users/me/password
     * Change the current user's password (requires old password verification).
     */
    @PatchMapping("/password")
    public ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(userDetails.getUsername(), request);
        return ResponseEntity.noContent().build(); // 204 No Content
    }

    /**
     * POST /api/v1/users/me/logout
     * JWT is stateless — actual logout is handled client-side by discarding the token.
     * This endpoint exists as a convention and can be extended with token blacklisting later.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent().build(); // 204 No Content
    }
}
