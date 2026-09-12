package com.fitness.backend.repository;

import com.fitness.backend.entity.Video;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface VideoRepository extends JpaRepository<Video, UUID> {

    List<Video> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<Video> findByStatus(String status);


    /**
     * Paginated history — ALL exercise types, no date filter.
     * PostgreSQL cannot infer the type of null parameters used in "IS NULL" checks,
     * so we use separate queries instead of optional parameter patterns.
     */
    @Query("""
        SELECT v FROM Video v
        WHERE v.user.id = :userId
        AND v.status = 'COMPLETED'
        ORDER BY v.createdAt DESC
    """)
    Page<Video> findCompletedHistoryAll(
            @Param("userId") UUID userId,
            Pageable pageable);

    /**
     * Paginated history — filtered by exercise type only.
     */
    @Query("""
        SELECT v FROM Video v
        WHERE v.user.id = :userId
        AND v.status = 'COMPLETED'
        AND v.exerciseType = :exerciseType
        ORDER BY v.createdAt DESC
    """)
    Page<Video> findCompletedHistoryByType(
            @Param("userId") UUID userId,
            @Param("exerciseType") String exerciseType,
            Pageable pageable);

    /**
     * Paginated history — filtered by exercise type and date range.
     * Only called when both fromDate and toDate are non-null.
     */
    @Query("""
        SELECT v FROM Video v
        WHERE v.user.id = :userId
        AND v.status = 'COMPLETED'
        AND v.exerciseType = :exerciseType
        AND v.createdAt >= :fromDate
        AND v.createdAt <= :toDate
        ORDER BY v.createdAt DESC
    """)
    Page<Video> findCompletedHistoryByTypeAndDates(
            @Param("userId") UUID userId,
            @Param("exerciseType") String exerciseType,
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate,
            Pageable pageable);

    /**
     * Paginated history — all exercise types, with date range.
     * Only called when both fromDate and toDate are non-null.
     */
    @Query("""
        SELECT v FROM Video v
        WHERE v.user.id = :userId
        AND v.status = 'COMPLETED'
        AND v.createdAt >= :fromDate
        AND v.createdAt <= :toDate
        ORDER BY v.createdAt DESC
    """)
    Page<Video> findCompletedHistoryAllByDates(
            @Param("userId") UUID userId,
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate,
            Pageable pageable);

    /**
     * All completed sessions for a specific exercise type (for trend/insight analysis).
     */
    @Query("""
        SELECT v FROM Video v
        WHERE v.user.id = :userId
        AND v.exerciseType = :exerciseType
        AND v.status = 'COMPLETED'
        AND v.analysisResult IS NOT NULL
        ORDER BY v.createdAt ASC
    """)
    List<Video> findCompletedByExerciseType(
            @Param("userId") UUID userId,
            @Param("exerciseType") String exerciseType);

    /**
     * Distinct exercise types a user has completed sessions for.
     */
    @Query("""
        SELECT DISTINCT v.exerciseType FROM Video v
        WHERE v.user.id = :userId
        AND v.status = 'COMPLETED'
        ORDER BY v.exerciseType ASC
    """)
    List<String> findDistinctExerciseTypes(@Param("userId") UUID userId);
}
