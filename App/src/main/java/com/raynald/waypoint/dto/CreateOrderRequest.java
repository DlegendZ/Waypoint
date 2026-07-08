package com.raynald.waypoint.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class CreateOrderRequest {
    private Long customerId;
    private Long driverId;
    private Float pickUpLat;
    private Float pickUpLng;
    private Float dropOffLat;
    private Float dropOffLng;
    private String currentStage;
}
