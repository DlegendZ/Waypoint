package com.raynald.waypoint.repository;

import com.raynald.waypoint.entity.OrderEntity;
import com.raynald.waypoint.enums.Stage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<OrderEntity, Long> {

    @Query("SELECT o.currentStage, COUNT(o) FROM OrderEntity o GROUP BY o.currentStage")
    List<Object[]> countOrderByStage();
}
