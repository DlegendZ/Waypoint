package com.raynald.waypoint.mapper;

import com.raynald.waypoint.dto.CreateOrderRequest;
import com.raynald.waypoint.dto.OrderResponse;
import com.raynald.waypoint.dto.UpdateOrderStatusRequest;
import com.raynald.waypoint.entity.OrderEntity;
import com.raynald.waypoint.entity.OrderStageHistoryEntity;
import com.raynald.waypoint.entity.UserEntity;
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
                .currentStage(OrderEntity.Stage.valueOf(request.getCurrentStage().toUpperCase()))
                .build();
    }

    public OrderStageHistoryEntity toEntity(UpdateOrderStatusRequest request, OrderEntity order, UserEntity actorId) {
        return OrderStageHistoryEntity.builder()
                .orderId(order)
                .fromStage(OrderStageHistoryEntity.Stage.valueOf(order.getCurrentStage().name()))
                .toStage(OrderStageHistoryEntity.Stage.valueOf(request.getUpdatedStage()))
                .actorId(actorId)
                .build();
    }

    public OrderResponse toResponse(OrderEntity order) {
        return OrderResponse.builder()
                .id(order.getId())
                .customerId(order.getCustomerId().getId())
                .driverId(order.getDriverId().getId())
                .pickUpLat(order.getPickUpLat())
                .pickUpLng(order.getPickUpLng())
                .dropOffLat(order.getDropOffLat())
                .dropOffLng(order.getDropOffLng())
                .currentStage(order.getCurrentStage().name())
                .createdAt(order.getCreatedAt().toString())
                .build();
    }
}
