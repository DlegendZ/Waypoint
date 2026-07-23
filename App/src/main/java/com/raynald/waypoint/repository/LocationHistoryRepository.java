package com.raynald.waypoint.repository;

import com.raynald.waypoint.entity.LocationHistoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LocationHistoryRepository extends JpaRepository<LocationHistoryEntity, Long> {

}
