package com.fitness.backend.controller;

import com.fitness.backend.dto.response.ProgressHistoryResponse;
import com.fitness.backend.dto.response.ProgressInsightResponse;
import com.fitness.backend.dto.response.ProgressTrendResponse;
import com.fitness.backend.security.JwtUtil;
import com.fitness.backend.service.ProgressService;
import lombok.RequiredArgsConstructor;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/v1/progress")
@RequiredArgsConstructor
public class ProgressController {

        private static final Logger log = LogManager.getLogger(ProgressController.class);

    private final ProgressService progressService;
        private final JwtUtil jwtUtil;

        @GetMapping("/ping")
        public ResponseEntity<String> ping() {
                return ResponseEntity.ok("pong");
        }

    /**
     * GET /api/v1/progress/history
     * Retrieve paginated exercise history for the authenticated user.
     *
     * Query params:
     * - exerciseType: (optional) Filter by exercise (SQUAT, BENCH_PRESS, DEADLIFT)
     * - fromDate: (optional) Filter from date (ISO-8601)
     * - toDate: (optional) Filter to date (ISO-8601)
     * - page: (default 0)
     * - size: (default 20)
     */
    @GetMapping("/history")
    public ResponseEntity<ProgressHistoryResponse> getHistory(
            HttpServletRequest request,
            @RequestParam(required = false) String exerciseType,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {

        String userEmail = resolveUserEmail(request);
        log.info("Progress history requested | user={} | exerciseType={} | page={} | size={}",
                userEmail, exerciseType, pageable.getPageNumber(), pageable.getPageSize());

        LocalDateTime from = fromDate != null ? LocalDateTime.parse(fromDate) : null;
        LocalDateTime to = toDate != null ? LocalDateTime.parse(toDate) : null;

        ProgressHistoryResponse response = progressService.getHistory(
                userEmail,
                exerciseType,
                from,
                to,
                pageable);

        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/v1/progress/trends/{exerciseType}
     * Retrieve trend analysis for a specific exercise.
     *
     * Returns: best score, average, delta (last N vs previous N), consistency, trend status, and score points for charting.
     */
    @GetMapping("/trends/{exerciseType}")
    public ResponseEntity<ProgressTrendResponse> getTrends(
            HttpServletRequest request,
            @PathVariable String exerciseType) {

        String userEmail = resolveUserEmail(request);
        ProgressTrendResponse response = progressService.getTrends(
                userEmail,
                exerciseType.toUpperCase());

        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/v1/progress/insights/{exerciseType}
     * Retrieve auto-generated insights based on performance trends and common errors.
     *
     * Returns: overall trend, actionable insights, and top recurring errors.
     */
    @GetMapping("/insights/{exerciseType}")
    public ResponseEntity<ProgressInsightResponse> getInsights(
                        HttpServletRequest request,
            @PathVariable String exerciseType) {

                String userEmail = resolveUserEmail(request);
        ProgressInsightResponse response = progressService.getInsights(
                                userEmail,
                exerciseType.toUpperCase());

        return ResponseEntity.ok(response);
    }

        private String resolveUserEmail(HttpServletRequest request) {
                String authHeader = request.getHeader("Authorization");
                if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing bearer token");
                }

                try {
                        return jwtUtil.extractEmail(authHeader.substring(7));
                } catch (Exception ex) {
                        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid bearer token");
                }
        }
}
