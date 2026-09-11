package com.raynald.waypoint.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
public class OrderHistoryResponse {
    private OrderResponse order;
    private List<StageHistoryResponse> stages;
    private List<RoutePointResponse> route;
}
