package com.raynald.waypoint.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class UpdateLocationRequest {
    private Double lat;
    private Double lng;
}
