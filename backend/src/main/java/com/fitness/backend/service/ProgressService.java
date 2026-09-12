package com.fitness.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fitness.backend.dto.response.*;
import com.fitness.backend.entity.AnalysisResult;
import com.fitness.backend.entity.RepDetail;
import com.fitness.backend.entity.User;
import com.fitness.backend.entity.Video;
import com.fitness.backend.repository.UserRepository;
import com.fitness.backend.repository.VideoRepository;
import lombok.RequiredArgsConstructor;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProgressService {

    private static final Logger log = LogManager.getLogger(ProgressService.class);

    private final VideoRepository videoRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    private static final int MIN_SESSIONS_FOR_TREND = 3;
    private static final int TREND_WINDOW = 5; // Compare last N vs previous N


    public ProgressHistoryResponse getHistory(
            String userEmail,
            String exerciseType,
            LocalDateTime fromDate,
            LocalDateTime toDate,
            Pageable pageable) {

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + userEmail));

        boolean hasType  = exerciseType != null && !exerciseType.isBlank();
        boolean hasDates = fromDate != null && toDate != null;

        Page<Video> page;
        if (hasType && hasDates) {
            page = videoRepository.findCompletedHistoryByTypeAndDates(user.getId(), exerciseType, fromDate, toDate, pageable);
        } else if (hasType) {
            page = videoRepository.findCompletedHistoryByType(user.getId(), exerciseType, pageable);
        } else if (hasDates) {
            page = videoRepository.findCompletedHistoryAllByDates(user.getId(), fromDate, toDate, pageable);
        } else {
            page = videoRepository.findCompletedHistoryAll(user.getId(), pageable);
        }

        List<ProgressHistoryItemResponse> items = page.getContent().stream()
                .map(v -> new ProgressHistoryItemResponse(
                        v.getId(),
                        v.getExerciseType(),
                        v.getStatus(),
                        v.getAnalysisResult() != null ? v.getAnalysisResult().getOverallScore() : null,
                        v.getAnalysisResult() != null ? v.getAnalysisResult().getTotalReps() : null,
                        v.getCreatedAt()))
                .toList();

        return new ProgressHistoryResponse(
                items,
                (int) page.getTotalElements(),
                page.getNumber(),
                page.getSize(),
                page.getTotalPages());
    }


    public ProgressTrendResponse getTrends(String userEmail, String exerciseType) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + userEmail));

        List<Video> sessions = videoRepository.findCompletedByExerciseType(user.getId(), exerciseType);

        if (sessions.isEmpty()) {
            return new ProgressTrendResponse(
                    exerciseType,
                    0,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    "insufficient_data",
                    List.of());
        }

        List<Float> scores = sessions.stream()
                .map(v -> v.getAnalysisResult().getOverallScore())
                .collect(Collectors.toList());

        float bestScore = scores.stream().max(Float::compare).orElse(0f);
        float avgScore = (float) scores.stream().mapToDouble(f -> f).average().orElse(0);

        Float avgLastN = null;
        Float avgPreviousN = null;
        Float scoreDelta = null;
        String trend = "insufficient_data";

        if (scores.size() >= TREND_WINDOW * 2) {
            List<Float> lastN = scores.subList(Math.max(0, scores.size() - TREND_WINDOW), scores.size());
            List<Float> previousN = scores.subList(0, TREND_WINDOW);

            avgLastN = (float) lastN.stream().mapToDouble(f -> f).average().orElse(0);
            avgPreviousN = (float) previousN.stream().mapToDouble(f -> f).average().orElse(0);
            scoreDelta = avgLastN - avgPreviousN;

            if (scoreDelta >= 3) {
                trend = "improving";
            } else if (scoreDelta <= -3) {
                trend = "declining";
            } else {
                trend = "stable";
            }
        } else if (scores.size() >= MIN_SESSIONS_FOR_TREND) {
            trend = "early_stage";
        }

        Double consistency = null;
        if (scores.size() > 1) {
            double mean = avgScore;
            double variance = scores.stream()
                    .mapToDouble(s -> Math.pow(s - mean, 2))
                    .average()
                    .orElse(0);
            consistency = Math.sqrt(variance);
        }

        List<ProgressTrendResponse.ScorePoint> scorePoints = sessions.stream()
                .map(v -> new ProgressTrendResponse.ScorePoint(
                        v.getCreatedAt(),
                        v.getAnalysisResult().getOverallScore(),
                        v.getAnalysisResult().getTotalReps()))
                .collect(Collectors.toList());

        return new ProgressTrendResponse(
                exerciseType,
                sessions.size(),
                bestScore,
                avgScore,
                avgLastN,
                avgPreviousN,
                scoreDelta,
                consistency != null ? consistency.floatValue() : null,
                trend,
                scorePoints);
    }


    public ProgressInsightResponse getInsights(String userEmail, String exerciseType) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + userEmail));

        List<Video> sessions = videoRepository.findCompletedByExerciseType(user.getId(), exerciseType);

        if (sessions.isEmpty()) {
            return new ProgressInsightResponse(
                    exerciseType, 0, "insufficient_data",
                    List.of("No completed sessions yet. Start by recording your first workout!"),
                    List.of());
        }

        List<Float> scores = sessions.stream()
                .map(v -> v.getAnalysisResult().getOverallScore())
                .collect(Collectors.toList());

        String overallTrend = determineTrend(scores);

        List<String> insights = generateInsights(scores, sessions, overallTrend);

        List<ProgressInsightResponse.TopError> topErrors = extractTopErrors(sessions);

        return new ProgressInsightResponse(
                exerciseType,
                sessions.size(),
                overallTrend,
                insights,
                topErrors);
    }


    private String determineTrend(List<Float> scores) {
        if (scores.size() < MIN_SESSIONS_FOR_TREND) {
            return "insufficient_data";
        }

        if (scores.size() < TREND_WINDOW * 2) {
            return "early_stage";
        }

        List<Float> lastN = scores.subList(Math.max(0, scores.size() - TREND_WINDOW), scores.size());
        List<Float> previousN = scores.subList(0, TREND_WINDOW);

        float avgLastN = (float) lastN.stream().mapToDouble(f -> f).average().orElse(0);
        float avgPreviousN = (float) previousN.stream().mapToDouble(f -> f).average().orElse(0);
        float delta = avgLastN - avgPreviousN;

        if (delta >= 3) {
            return "improving";
        } else if (delta <= -3) {
            return "declining";
        } else {
            return "stable";
        }
    }

    private List<String> generateInsights(List<Float> scores, List<Video> sessions, String trend) {
        List<String> insights = new ArrayList<>();

        if ("improving".equals(trend)) {
            float delta = (float) scores.stream().mapToDouble(f -> f).average().orElse(0)
                    - (float) scores.subList(0, Math.min(TREND_WINDOW, scores.size())).stream()
                    .mapToDouble(f -> f).average().orElse(0);
            insights.add(String.format("📈 Great progress! Your score has improved by %.1f points over your last sessions.", Math.abs(delta)));
        } else if ("declining".equals(trend)) {
            insights.add("📉 Your performance has been declining. Try to focus on form and consistency.");
        } else if ("stable".equals(trend)) {
            insights.add("→ Your performance is stable. Keep pushing to break through your current level.");
        } else if ("early_stage".equals(trend)) {
            insights.add("🆕 You're building a foundation. Complete more sessions to track meaningful progress.");
        }

        float best = scores.stream().max(Float::compare).orElse(0f);
        float latest = scores.get(scores.size() - 1);
        if (latest == best) {
            insights.add("⭐ Your latest session was your personal best! Keep it up.");
        }

        double mean = (float) scores.stream().mapToDouble(f -> f).average().orElse(0);
        double consistency = Math.sqrt(scores.stream()
                .mapToDouble(s -> Math.pow(s - mean, 2))
                .average()
                .orElse(0));

        if (consistency < 5) {
            insights.add("💪 Excellent consistency! Your form is very stable.");
        } else if (consistency > 15) {
            insights.add("⚠️ Your form varies significantly between sessions. Focus on technique refinement.");
        }

        return insights;
    }

    private List<ProgressInsightResponse.TopError> extractTopErrors(List<Video> sessions) {
        Map<String, Integer> errorCounts = new HashMap<>();
        int totalReps = 0;

        for (Video session : sessions) {
            AnalysisResult result = session.getAnalysisResult();
            if (result != null) {
                for (RepDetail rep : result.getRepDetails()) {
                    totalReps++;
                    try {
                        List<String> errors = fromJson(rep.getErrors());
                        for (String error : errors) {
                            errorCounts.put(error, errorCounts.getOrDefault(error, 0) + 1);
                        }
                    } catch (Exception e) {
                    }
                }
            }
        }

        final int totalRepsFinal = totalReps > 0 ? totalReps : 1;
        return errorCounts.entrySet().stream()
                .map(e -> new ProgressInsightResponse.TopError(
                        e.getKey(),
                        e.getValue(),
                        (float) e.getValue() / totalRepsFinal * 100))
                .sorted((a, b) -> Integer.compare(b.occurrences(), a.occurrences()))
                .limit(5)
                .toList();
    }

    @SuppressWarnings("unchecked")
    private List<String> fromJson(String json) {
        if (json == null) return List.of();
        try {
            return objectMapper.readValue(json, List.class);
        } catch (Exception e) {
            return List.of();
        }
    }
}
