package com.raynald.waypoint.controller;

import com.raynald.waypoint.dto.UpdateLocationRequest;
import com.raynald.waypoint.service.DriverLocationService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
public class LocationController {

    private final DriverLocationService driverLocationService;
    private final SimpMessagingTemplate simpMessagingTemplate;

    @MessageMapping("/location/{orderId}")
    public void BroadcastLocation(@DestinationVariable Long orderId, UpdateLocationRequest request, Principal principal) {
        driverLocationService.saveLocation(orderId, request, principal.getName());

        String subs_destination = "/topic/order/" + orderId;
        simpMessagingTemplate.convertAndSend(subs_destination, driverLocationService.getLocation(orderId));
    }

}
