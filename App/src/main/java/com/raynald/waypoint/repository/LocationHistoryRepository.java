package com.raynald.waypoint.repository;

import com.raynald.waypoint.entity.LocationHistoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LocationHistoryRepository extends JpaRepository<LocationHistoryEntity, Long> {

}
