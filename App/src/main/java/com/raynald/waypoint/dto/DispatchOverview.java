package com.raynald.waypoint.dto;

import com.raynald.waypoint.enums.Stage;
import com.raynald.waypoint.enums.Status;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
@AllArgsConstructor
public class DispatchOverview {
    private Map<Stage, Long> orderByStage;
    private Map<Status, Long> driverByStatus;
    private List<FlaggedOrder> flaggedOrders;
}
