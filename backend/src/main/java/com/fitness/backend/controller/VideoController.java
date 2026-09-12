package com.fitness.backend.controller;

import com.fitness.backend.dto.response.AnalysisResultResponse;
import com.fitness.backend.dto.response.VideoUploadResponse;
import com.fitness.backend.dto.response.ClassificationResponse;
import com.fitness.backend.service.VideoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/videos")
@RequiredArgsConstructor
public class VideoController {

    private final VideoService videoService;

    /**
     * POST /api/v1/videos
     * Upload a video and trigger AI analysis.
     * Accepts multipart/form-data with fields: file, exerciseType
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<VideoUploadResponse> upload(
            @RequestPart("file") MultipartFile file,
            @RequestPart("exerciseType") String exerciseType,
            @AuthenticationPrincipal UserDetails userDetails) {
        VideoUploadResponse response = videoService.uploadAndAnalyze(
                file, exerciseType, userDetails.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * POST /api/v1/videos/classify
     * Upload a video to automatically detect the exercise type.
     */
    @PostMapping(value = "/classify", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ClassificationResponse> classify(
            @RequestPart("file") MultipartFile file) {
        ClassificationResponse response = videoService.classifyVideo(file);
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/v1/videos/{id}/result
     * Retrieve the analysis result for a specific video.
     */
    @GetMapping("/{id}/result")
    public ResponseEntity<AnalysisResultResponse> getResult(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(
                videoService.getResult(id, userDetails.getUsername()));
    }

    /**
     * GET /api/v1/videos/{id}/stream-annotated
     * Stream the annotated video with the MediaPipe skeleton.
     */
    @GetMapping(value = "/{id}/stream-annotated", produces = "video/mp4")
    public ResponseEntity<org.springframework.core.io.Resource> streamAnnotatedVideo(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(
                videoService.getAnnotatedVideoResource(id, userDetails.getUsername()));
    }
}
