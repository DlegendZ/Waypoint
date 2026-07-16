package com.raynald.waypoint.controller;

import com.raynald.waypoint.dto.UpdateLocation;
import com.raynald.waypoint.service.DriverLocationService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
public class LocationController {

    private final DriverLocationService driverLocationService;

    @MessageMapping("/location/{orderId}")
    public void receiveLocation(@DestinationVariable Long orderId, UpdateLocation request, Principal principal) {
        driverLocationService.saveLocation(orderId, request, principal.getName());
    }

}
