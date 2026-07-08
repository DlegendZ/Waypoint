package com.raynald.waypoint.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class OrderResponse {
    private Long id;
    private Long customerId;
    private Long driverId;
    private Float pickUpLat;
    private Float pickUpLng;
    private Float dropOffLat;
    private Float dropOffLng;
    private String currentStage;
    private String createdAt;
}
