package com.raynald.waypoint.repository;

import com.raynald.waypoint.entity.LocationHistoryEntity;
import com.raynald.waypoint.entity.OrderEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LocationHistoryRepository extends JpaRepository<LocationHistoryEntity, Long> {

    List<LocationHistoryEntity> findByOrderIdOrderByRecordedAtAscIdAsc(OrderEntity orderId);
}
