package com.raynald.waypoint.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class LocationBroadcastResponse {
    private Double lat;
    private Double lng;
    private Integer eta;
    private Double distance;
    private String timestamp;
}
