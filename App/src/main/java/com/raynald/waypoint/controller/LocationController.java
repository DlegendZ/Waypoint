package com.raynald.waypoint.controller;

import com.raynald.waypoint.dto.UpdateLocation;
import com.raynald.waypoint.service.DriverLocationService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class LocationController {

    private final DriverLocationService driverLocationService;

    @MessageMapping("/Location/{orderId}")
    public void receiveLocation(@DestinationVariable Long orderId, UpdateLocation request) {
        driverLocationService.saveLocation(orderId, request);
    }

}
