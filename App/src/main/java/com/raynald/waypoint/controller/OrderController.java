package com.raynald.waypoint.controller;

import com.raynald.waypoint.dto.CreateOrderRequest;
import com.raynald.waypoint.dto.ErrorResponse;
import com.raynald.waypoint.dto.OrderResponse;
import com.raynald.waypoint.dto.UpdateOrderStatusRequest;
import com.raynald.waypoint.service.OrderService;
import com.raynald.waypoint.service.RateLimiterService;
import com.raynald.waypoint.util.ClientIpUtil;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
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
@SecurityRequirement(name = "cookieAuth")
public class OrderController {

    private final OrderService orderService;
    private final RateLimiterService rateLimiterService;

    @PostMapping
    public ResponseEntity<?> createOrder(
            @Valid @RequestBody CreateOrderRequest request,
            Authentication authentication,
            HttpServletRequest servletRequest) {
        String customerEmail = authentication.getName();

        RateLimiterService.RateLimitResult userLimit = rateLimiterService.checkUserLimit(customerEmail);
        if (!userLimit.allowed()) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header(HttpHeaders.RETRY_AFTER, String.valueOf(userLimit.retryAfterSeconds()))
                    .body(new ErrorResponse("Too many orders created. Try again in " + userLimit.retryAfterSeconds() + "s."));
        }

        String ip = ClientIpUtil.resolve(servletRequest);
        RateLimiterService.RateLimitResult ipLimit = rateLimiterService.checkIpLimit(ip);
        if (!ipLimit.allowed()) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header(HttpHeaders.RETRY_AFTER, String.valueOf(ipLimit.retryAfterSeconds()))
                    .body(new ErrorResponse("Too many orders created from this network. Try again in " + ipLimit.retryAfterSeconds() + "s."));
        }

        OrderResponse response = orderService.createOrder(request, customerEmail);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<OrderResponse> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateOrderStatusRequest request,
            Authentication authentication) {
        String actorEmail = authentication.getName();
        OrderResponse response = orderService.updateStatus(id, request.getUpdatedStage(), actorEmail);
        return ResponseEntity.ok(response);
    }
}
