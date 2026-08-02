package com.raynald.waypoint.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class UpdateOrderStatusRequest {
    @NotBlank(message = "updatedStage is required")
    private String updatedStage;
}
