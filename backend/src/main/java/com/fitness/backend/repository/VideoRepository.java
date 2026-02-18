package com.fitness.backend.repository;

import com.fitness.backend.entity.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface VideoRepository extends JpaRepository<Video, UUID> {

    List<Video> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<Video> findByStatus(String status);
}
