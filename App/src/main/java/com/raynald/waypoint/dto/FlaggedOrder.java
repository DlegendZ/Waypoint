package com.raynald.waypoint.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.io.Serializable;

@Data
@Builder
@AllArgsConstructor
public class FlaggedOrder implements Serializable {
    private Long orderId;
    private String reason;
    private String flaggedAt;
}
