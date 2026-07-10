package com.raynald.waypoint.mapper;

import com.raynald.waypoint.dto.DriverProfileResponse;
import com.raynald.waypoint.entity.DriverProfileEntity;
import org.springframework.stereotype.Component;

@Component
public class DriverMapper {

    public DriverProfileResponse toResponse(DriverProfileEntity driverProfile) {
        return DriverProfileResponse.builder()
                .id(driverProfile.getId())
                .userId(driverProfile.getUserId().getId())
                .status(driverProfile.getStatus().name())
                .currentLat(driverProfile.getCurrentLat())
                .currentLng(driverProfile.getCurrentLng())
                .lastUpdatedAt(driverProfile.getLastUpdatedAt().toString())
                .build();
    }
}
