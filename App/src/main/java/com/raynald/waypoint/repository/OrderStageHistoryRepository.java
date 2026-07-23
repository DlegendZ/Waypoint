package com.raynald.waypoint.repository;

import com.raynald.waypoint.entity.OrderStageHistoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OrderStageHistoryRepository extends JpaRepository<OrderStageHistoryEntity, Long> {
}
