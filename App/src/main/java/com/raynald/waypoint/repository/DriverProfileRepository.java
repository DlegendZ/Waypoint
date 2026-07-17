package com.raynald.waypoint.repository;

import com.raynald.waypoint.entity.DriverProfileEntity;
import com.raynald.waypoint.entity.UserEntity;
import com.raynald.waypoint.enums.Status;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DriverProfileRepository extends JpaRepository<DriverProfileEntity, Long> {
    Optional<DriverProfileEntity> findByUserId(UserEntity userId);

    List<DriverProfileEntity> findByStatus(Status status);
}
