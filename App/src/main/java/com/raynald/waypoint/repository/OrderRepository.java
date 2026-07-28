package com.raynald.waypoint.repository;

import com.raynald.waypoint.entity.OrderEntity;
import com.raynald.waypoint.entity.UserEntity;
import com.raynald.waypoint.enums.Stage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<OrderEntity, Long> {

    @Query("SELECT o.currentStage, COUNT(o) FROM OrderEntity o GROUP BY o.currentStage")
    List<Object[]> countOrderByStage();

    List<OrderEntity> findByDriverIdAndCurrentStageIn(UserEntity driverId, Collection<Stage> stages);

    List<OrderEntity> findByFlaggedTrue();
}
