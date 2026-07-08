package com.raynald.waypoint.repository;

import com.raynald.waypoint.entity.OrderStageHistoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderStageHistoryRepository extends JpaRepository<OrderStageHistoryEntity, Long> {
}
