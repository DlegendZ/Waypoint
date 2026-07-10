package com.raynald.waypoint.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class DriverProfileResponse {
    private Long id;
    private Long userId;
    private String status;
    private Double currentLat;
    private Double currentLng;
    private String lastUpdatedAt;
}
