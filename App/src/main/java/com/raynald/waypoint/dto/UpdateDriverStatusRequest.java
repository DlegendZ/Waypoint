package com.raynald.waypoint.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class UpdateDriverStatusRequest {
    private String updatedStatus;
}
