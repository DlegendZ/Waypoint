package com.raynald.waypoint.mapper;

import com.raynald.waypoint.dto.CreateOrderRequest;
import com.raynald.waypoint.dto.OrderResponse;
import com.raynald.waypoint.dto.StageHistoryResponse;
import com.raynald.waypoint.entity.OrderEntity;
import com.raynald.waypoint.entity.OrderStageHistoryEntity;
import com.raynald.waypoint.entity.UserEntity;
import com.raynald.waypoint.enums.Stage;
import com.raynald.waypoint.util.TimeUtil;
import org.springframework.stereotype.Component;

@Component
public class OrderMapper {

    public OrderEntity toEntity(CreateOrderRequest request, UserEntity customerId, UserEntity driverId) {
        return OrderEntity.builder()
                .customerId(customerId)
                .driverId(driverId)
                .pickUpLat(request.getPickUpLat())
                .pickUpLng(request.getPickUpLng())
                .dropOffLat(request.getDropOffLat())
                .dropOffLng(request.getDropOffLng())
                .build();
    }

    public OrderStageHistoryEntity toEntity(Stage toStage, OrderEntity order, UserEntity actor) {
        return OrderStageHistoryEntity.builder()
                .orderId(order)
                .fromStage(Stage.valueOf(order.getCurrentStage().name()))
                .toStage(Stage.valueOf(toStage.name()))
                .actorId(actor)
                .build();
    }

    public OrderResponse toResponse(OrderEntity order) {
        UserEntity driver = order.getDriverId();
        UserEntity customer = order.getCustomerId();
        return OrderResponse.builder()
                .id(order.getId())
                .customerId(customer.getId())
                .customerName(customer.getName())
                .driverId(driver != null ? driver.getId() : null)
                .driverName(driver != null ? driver.getName() : null)
                .pickUpLat(order.getPickUpLat())
                .pickUpLng(order.getPickUpLng())
                .dropOffLat(order.getDropOffLat())
                .dropOffLng(order.getDropOffLng())
                .currentStage(order.getCurrentStage().name())
                .createdAt(TimeUtil.toIso(order.getCreatedAt()))
                .flagged(order.isFlagged())
                .flagReason(order.getFlagReason())
                .build();
    }

    public StageHistoryResponse toStageResponse(OrderStageHistoryEntity history) {
        return StageHistoryResponse.builder()
                .fromStage(history.getFromStage().name())
                .toStage(history.getToStage().name())
                .changedAt(TimeUtil.toIso(history.getChangedAt()))
                .actorId(history.getActorId() != null ? history.getActorId().getId() : null)
                .build();
    }
}
