package com.raynald.waypoint.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class UpdateDriverStatusRequest {
    @NotBlank(message = "updatedStatus is required")
    private String updatedStatus;

    // Optional current position (both or neither) - used for nearest-driver matching.
    @DecimalMin(value = "-90", message = "lat must be >= -90")
    @DecimalMax(value = "90", message = "lat must be <= 90")
    private Double lat;

    @DecimalMin(value = "-180", message = "lng must be >= -180")
    @DecimalMax(value = "180", message = "lng must be <= 180")
    private Double lng;
}
