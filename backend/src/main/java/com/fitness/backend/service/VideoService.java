package com.fitness.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fitness.backend.dto.response.AnalysisResultResponse;
import com.fitness.backend.dto.response.VideoUploadResponse;
import com.fitness.backend.entity.AnalysisResult;
import com.fitness.backend.entity.RepDetail;
import com.fitness.backend.entity.User;
import com.fitness.backend.entity.Video;
import com.fitness.backend.repository.AnalysisResultRepository;
import com.fitness.backend.repository.UserRepository;
import com.fitness.backend.repository.VideoRepository;
import lombok.RequiredArgsConstructor;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VideoService {

    private static final Logger log = LogManager.getLogger(VideoService.class);

    private final VideoRepository videoRepository;
    private final UserRepository userRepository;
    private final AnalysisResultRepository analysisResultRepository;
    private final AiServiceClient aiServiceClient;
    private final ObjectMapper objectMapper;

    @Value("${app.video-storage-path}")
    private String storagePath;


    public VideoUploadResponse uploadAndAnalyze(MultipartFile file, String exerciseType, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + userEmail));

        String filePath = saveFile(file);
        log.info("Video saved | path={} | user={}", filePath, userEmail);

        Video video = Video.builder()
                .user(user)
                .exerciseType(exerciseType.toUpperCase())
                .filePath(filePath)
                .status("PROCESSING")
                .fileSizeBytes(file.getSize())
                .build();
        videoRepository.save(video);

        try {
            AiServiceClient.AiAnalysisResult aiResult = aiServiceClient.analyze(video.getId(), filePath, exerciseType);

            AnalysisResult result = AnalysisResult.builder()
                    .video(video)
                    .totalReps(aiResult.totalReps())
                    .overallScore((float) aiResult.overallScore())
                    .feedback(toJson(aiResult.feedback()))
                    .build();

            List<RepDetail> repDetails = aiResult.repDetails().stream()
                    .map(r -> RepDetail.builder()
                            .analysisResult(result)
                            .repNumber(r.repNumber())
                            .score((float) r.score())
                            .errors(toJson(r.errors()))
                            .exerciseMetrics(r.exerciseMetrics() != null ? toJson(r.exerciseMetrics()) : null)
                            .build())
                    .toList();

            result.getRepDetails().addAll(repDetails);
            analysisResultRepository.save(result);

            video.setStatus("COMPLETED");
            videoRepository.save(video);
            log.info("Analysis saved | videoId={} | reps={} | score={}",
                    video.getId(), aiResult.totalReps(), aiResult.overallScore());

        } catch (Exception e) {
            video.setStatus("FAILED");
            videoRepository.save(video);
            log.error("Analysis failed for videoId={}: {}", video.getId(), e.getMessage());
        }

        return new VideoUploadResponse(video.getId(), video.getExerciseType(),
                video.getStatus(), video.getCreatedAt());
    }

    public com.fitness.backend.dto.response.ClassificationResponse classifyVideo(MultipartFile file) {
        log.info("Classifying video...");
        AiServiceClient.AiClassificationResult aiResult = aiServiceClient.classify(file);
        
        return new com.fitness.backend.dto.response.ClassificationResponse(
                aiResult.detectedExercise(),
                aiResult.confidence(),
                aiResult.framesAnalyzed()
        );
    }


    public AnalysisResultResponse getResult(UUID videoId, String userEmail) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new RuntimeException("Video not found: " + videoId));

        if (!video.getUser().getEmail().equals(userEmail)) {
            throw new RuntimeException("Access denied");
        }

        if (video.getAnalysisResult() == null) {
            return new AnalysisResultResponse(videoId, video.getStatus(),
                    null, null, List.of(), List.of());
        }

        AnalysisResult ar = video.getAnalysisResult();
        List<AnalysisResultResponse.RepDetailResponse> reps = ar.getRepDetails().stream()
                .map(r -> new AnalysisResultResponse.RepDetailResponse(
                        r.getRepNumber(), r.getScore(), fromJson(r.getErrors()),
                        r.getExerciseMetrics() != null ? fromJsonMap(r.getExerciseMetrics()) : null))
                .toList();

        return new AnalysisResultResponse(videoId, video.getStatus(),
                ar.getTotalReps(), ar.getOverallScore(),
                fromJson(ar.getFeedback()), reps);
    }

    public org.springframework.core.io.Resource getAnnotatedVideoResource(UUID videoId, String userEmail) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new RuntimeException("Video not found: " + videoId));

        if (!video.getUser().getEmail().equals(userEmail)) {
            throw new RuntimeException("Access denied");
        }

        String originalPath = video.getFilePath();
        String annotatedPath = originalPath
                .replace(".mp4", "_annotated.mp4")
                .replace(".MOV", "_annotated.mp4")
                .replace(".mov", "_annotated.mp4");
                
        if (!annotatedPath.endsWith("_annotated.mp4")) {
            annotatedPath = originalPath + "_annotated.mp4";
        }

        try {
            Path path = Paths.get(annotatedPath);
            if (!Files.exists(path)) {
                path = Paths.get(originalPath);
            }
            return new org.springframework.core.io.UrlResource(path.toUri());
        } catch (java.net.MalformedURLException e) {
            throw new RuntimeException("Error reading video file", e);
        }
    }


    private String saveFile(MultipartFile file) {
        try {
            Path dir = Paths.get(storagePath);
            Files.createDirectories(dir);
            String fileName = UUID.randomUUID() + "_" + file.getOriginalFilename();
            Path dest = dir.resolve(fileName);
            file.transferTo(dest.toFile());
            return dest.toAbsolutePath().toString();
        } catch (IOException e) {
            throw new RuntimeException("Failed to save video file: " + e.getMessage(), e);
        }
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return "[]";
        }
    }

    @SuppressWarnings("unchecked")
    private List<String> fromJson(String json) {
        if (json == null)
            return List.of();
        try {
            return objectMapper.readValue(json, List.class);
        } catch (Exception e) {
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    private java.util.Map<String, Object> fromJsonMap(String json) {
        if (json == null)
            return null;
        try {
            return objectMapper.readValue(json, java.util.Map.class);
        } catch (Exception e) {
            return null;
        }
    }
}
