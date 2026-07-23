package com.raynald.waypoint.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class FlaggedOrder {
    private Long orderId;
    private String reason;
    private String flaggedAt;
}
