package com.raynald.waypoint.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class StageHistoryResponse {
    private String fromStage;
    private String toStage;
    private String changedAt;
    // Null when the system made the change (e.g. automatic driver assignment).
    private Long actorId;
}
