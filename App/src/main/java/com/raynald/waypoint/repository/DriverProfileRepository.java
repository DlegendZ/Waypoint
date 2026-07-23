package com.raynald.waypoint.repository;

import com.raynald.waypoint.entity.DriverProfileEntity;
import com.raynald.waypoint.entity.UserEntity;
import com.raynald.waypoint.enums.Status;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DriverProfileRepository extends JpaRepository<DriverProfileEntity, Long> {
    Optional<DriverProfileEntity> findByUserId(UserEntity userId);

    List<DriverProfileEntity> findByStatus(Status status);

    @Query("SELECT d.Status, COUNT(d) FROM DriverProfileEntity d GROUP BY d.Status")
    List<Object[]> countDriverProfileByStatus();
}
