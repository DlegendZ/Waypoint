package com.raynald.waypoint.mapper;

import com.raynald.waypoint.dto.RoutePointResponse;
import com.raynald.waypoint.dto.UpdateLocationRequest;
import com.raynald.waypoint.entity.LocationHistoryEntity;
import com.raynald.waypoint.entity.OrderEntity;
import com.raynald.waypoint.util.TimeUtil;
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

    public RoutePointResponse toRoutePoint(LocationHistoryEntity point) {
        return RoutePointResponse.builder()
                .lat(point.getLat())
                .lng(point.getLng())
                .recordedAt(TimeUtil.toIso(point.getRecordedAt()))
                .build();
    }
}
