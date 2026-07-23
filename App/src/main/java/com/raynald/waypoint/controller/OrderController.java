package com.raynald.waypoint.controller;

import com.raynald.waypoint.dto.CreateOrderRequest;
import com.raynald.waypoint.dto.OrderResponse;
import com.raynald.waypoint.dto.UpdateOrderStatusRequest;
import com.raynald.waypoint.service.OrderService;
import com.raynald.waypoint.service.RateLimiterService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final RateLimiterService rateLimiterService;

    @PostMapping
    public ResponseEntity<OrderResponse> createOrder(
            @RequestBody CreateOrderRequest request,
            Authentication authentication) {
        String customerEmail = authentication.getName();

        if (!rateLimiterService.isUserAllowed(customerEmail)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(null);
        }

        OrderResponse response = orderService.createOrder(request, customerEmail);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<OrderResponse> updateStatus(
            @PathVariable Long id,
            @RequestBody UpdateOrderStatusRequest request,
            Authentication authentication) {
        String actorEmail = authentication.getName();
        OrderResponse response = orderService.updateStatus(id, request.getUpdatedStage(), actorEmail);
        return ResponseEntity.ok(response);
    }
}
