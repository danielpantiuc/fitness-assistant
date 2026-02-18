package com.fitness.backend.repository;

import com.fitness.backend.entity.RepDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RepDetailRepository extends JpaRepository<RepDetail, UUID> {

    List<RepDetail> findByAnalysisResultIdOrderByRepNumberAsc(UUID analysisResultId);
}
