package com.raynald.waypoint.repository;

import com.raynald.waypoint.entity.DriverProfileEntity;
import com.raynald.waypoint.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DriverProfileRepository extends JpaRepository<DriverProfileEntity, Long> {
    Optional<DriverProfileEntity> findByUserId(UserEntity userId);
}
