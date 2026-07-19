package com.raynald.waypoint.mapper;

import com.raynald.waypoint.dto.UpdateLocationRequest;
import com.raynald.waypoint.entity.LocationHistoryEntity;
import com.raynald.waypoint.entity.OrderEntity;
import org.springframework.stereotype.Component;

@Component
public class LocationHistoryMapper {

    public LocationHistoryEntity toEntity(OrderEntity orderId, UpdateLocationRequest request) {
        return LocationHistoryEntity.builder()
                .orderId(orderId)
                .lat(request.getLat())
                .lng(request.getLng())
                .build();
    }
}
