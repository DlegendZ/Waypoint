package com.raynald.waypoint.mapper;

import com.raynald.waypoint.dto.DriverProfileResponse;
import com.raynald.waypoint.entity.DriverProfileEntity;
import com.raynald.waypoint.util.TimeUtil;
import org.springframework.stereotype.Component;

@Component
public class DriverMapper {

    public DriverProfileResponse toResponse(DriverProfileEntity driverProfile) {
        return DriverProfileResponse.builder()
                .id(driverProfile.getId())
                .userId(driverProfile.getUserId().getId())
                .name(driverProfile.getUserId().getName())
                .status(driverProfile.getStatus().name())
                .currentLat(driverProfile.getCurrentLat())
                .currentLng(driverProfile.getCurrentLng())
                .lastUpdatedAt(TimeUtil.toIso(driverProfile.getLastUpdatedAt()))
                .build();
    }
}
