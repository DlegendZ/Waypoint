package com.raynald.waypoint.dto;

import com.raynald.waypoint.enums.Stage;
import com.raynald.waypoint.enums.Status;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

// Serializable because the Redis cache (@Cacheable on DispatchService) stores it with JDK serialization.
@Data
@Builder
@AllArgsConstructor
public class DispatchOverview implements Serializable {
    private Map<Stage, Long> orderByStage;
    private Map<Status, Long> driverByStatus;
    private List<FlaggedOrder> flaggedOrders;
}
