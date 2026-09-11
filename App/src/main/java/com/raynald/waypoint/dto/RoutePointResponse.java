package com.raynald.waypoint.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class RoutePointResponse {
    private Double lat;
    private Double lng;
    private String recordedAt;
}
