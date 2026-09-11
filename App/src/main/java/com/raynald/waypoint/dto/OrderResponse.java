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
    private String customerName;
    private Long driverId;
    private String driverName;
    private Double pickUpLat;
    private Double pickUpLng;
    private Double dropOffLat;
    private Double dropOffLng;
    private String currentStage;
    private String createdAt;
    private boolean flagged;
    private String flagReason;
}
