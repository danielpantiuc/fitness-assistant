package com.fitness.backend.service;

import lombok.RequiredArgsConstructor;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.core.io.ByteArrayResource;

@Service
@RequiredArgsConstructor
public class AiServiceClient {

    private static final Logger log = LogManager.getLogger(AiServiceClient.class);

    private final RestClient aiRestClient;

    /**
     * Calls the Python AI service to analyze a video.
     * This is a synchronous call — Spring Boot waits for the result.
     * (Async via @Async or message queue can be added in a future iteration)
     */
    public AiAnalysisResult analyze(UUID videoId, String filePath, String exerciseType) {
        log.info("Calling AI service | videoId={} | exercise={}", videoId, exerciseType);

        var requestBody = Map.of(
                "video_id", videoId.toString(),
                "file_path", filePath,
                "exercise_type", exerciseType);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = aiRestClient.post()
                    .uri("/api/v1/analyze")
                    .body(requestBody)
                    .retrieve()
                    .body(Map.class);

            log.info("AI service response received | videoId={}", videoId);
            return mapToResult(response);

        } catch (Exception e) {
            log.error("AI service call failed | videoId={} | error={}", videoId, e.getMessage());
            throw new RuntimeException("AI analysis failed: " + e.getMessage(), e);
        }
    }


    public record AiClassificationResult(
            String detectedExercise,
            double confidence,
            int framesAnalyzed) {
    }

    public AiClassificationResult classify(MultipartFile file) {
        log.info("Calling AI service for classification");
        try {
            var body = new LinkedMultiValueMap<String, Object>();
            body.add("file", new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename() != null ? file.getOriginalFilename() : "video.mp4";
                }
            });

            @SuppressWarnings("unchecked")
            Map<String, Object> response = aiRestClient.post()
                    .uri("/api/v1/analyze/classify")
                    .contentType(org.springframework.http.MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            return new AiClassificationResult(
                    (String) response.get("detected_exercise"),
                    ((Number) response.getOrDefault("confidence", 0)).doubleValue(),
                    ((Number) response.getOrDefault("frames_analyzed", 0)).intValue()
            );
        } catch (Exception e) {
            log.error("AI classification call failed | error={}", e.getMessage());
            throw new RuntimeException("AI classification failed: " + e.getMessage(), e);
        }
    }


    public record AiAnalysisResult(
            int totalReps,
            double overallScore,
            List<String> feedback,
            List<RepDetail> repDetails) {
        public record RepDetail(
                int repNumber,
                double score,
                List<String> errors,
                Map<String, Object> exerciseMetrics) {
        }
    }

    @SuppressWarnings("unchecked")
    private AiAnalysisResult mapToResult(Map<String, Object> raw) {
        List<Map<String, Object>> rawReps = (List<Map<String, Object>>) raw.getOrDefault("rep_details", List.of());

        List<AiAnalysisResult.RepDetail> repDetails = rawReps.stream()
                .map(r -> new AiAnalysisResult.RepDetail(
                        (int) r.getOrDefault("rep_number", 0),
                        ((Number) r.getOrDefault("score", 0)).doubleValue(),
                        (List<String>) r.getOrDefault("errors", List.of()),
                        r.get("exercise_metrics") != null ? (Map<String, Object>) r.get("exercise_metrics") : null))
                .toList();

        return new AiAnalysisResult(
                (int) raw.getOrDefault("total_reps", 0),
                ((Number) raw.getOrDefault("overall_score", 0)).doubleValue(),
                (List<String>) raw.getOrDefault("feedback", List.of()),
                repDetails);
    }

    private Double toDouble(Object val) {
        return val != null ? ((Number) val).doubleValue() : null;
    }
}
