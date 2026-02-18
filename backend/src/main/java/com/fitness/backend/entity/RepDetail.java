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

    @Column(length = 30)
    private String phase;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String errors;

    @Column(name = "min_knee_angle")
    private Float minKneeAngle;

    @Column(name = "min_hip_angle")
    private Float minHipAngle;

    @Column(name = "max_trunk_lean")
    private Float maxTrunkLean;
}
