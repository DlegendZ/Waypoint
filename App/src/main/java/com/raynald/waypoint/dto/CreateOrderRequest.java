package com.raynald.waypoint.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class CreateOrderRequest {
    private Double pickUpLat;
    private Double pickUpLng;
    private Double dropOffLat;
    private Double dropOffLng;
}
