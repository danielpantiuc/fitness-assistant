package com.fitness.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;

@Entity
@Table(name = "rep_details")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RepDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "analysis_id", nullable = false)
    private AnalysisResult analysisResult;

    @Column(name = "rep_number", nullable = false)
    private Integer repNumber;

    private Float score;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String errors;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "exercise_metrics", columnDefinition = "jsonb")
    private String exerciseMetrics;
}
