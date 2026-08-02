package com.raynald.waypoint.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class UpdateDriverStatusRequest {
    @NotBlank(message = "updatedStatus is required")
    private String updatedStatus;
}
