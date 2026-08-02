package com.raynald.waypoint.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class CreateOrderRequest {
    @NotNull(message = "pickUpLat is required")
    @DecimalMin(value = "-90", message = "pickUpLat must be >= -90")
    @DecimalMax(value = "90", message = "pickUpLat must be <= 90")
    private Double pickUpLat;

    @NotNull(message = "pickUpLng is required")
    @DecimalMin(value = "-180", message = "pickUpLng must be >= -180")
    @DecimalMax(value = "180", message = "pickUpLng must be <= 180")
    private Double pickUpLng;

    @NotNull(message = "dropOffLat is required")
    @DecimalMin(value = "-90", message = "dropOffLat must be >= -90")
    @DecimalMax(value = "90", message = "dropOffLat must be <= 90")
    private Double dropOffLat;

    @NotNull(message = "dropOffLng is required")
    @DecimalMin(value = "-180", message = "dropOffLng must be >= -180")
    @DecimalMax(value = "180", message = "dropOffLng must be <= 180")
    private Double dropOffLng;
}
