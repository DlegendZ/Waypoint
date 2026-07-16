package com.raynald.waypoint.service;

import com.raynald.waypoint.dto.UpdateLocation;
import com.raynald.waypoint.entity.OrderEntity;
import com.raynald.waypoint.entity.UserEntity;
import com.raynald.waypoint.enums.Stage;
import com.raynald.waypoint.exception.ForbiddenActionException;
import com.raynald.waypoint.exception.LocationNotFoundException;
import com.raynald.waypoint.exception.OrderNotFoundException;
import com.raynald.waypoint.exception.UserNotFoundException;
import com.raynald.waypoint.repository.OrderRepository;
import com.raynald.waypoint.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.EnumSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class DriverLocationService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;

    private static final Set<Stage> ACTIVE_STAGES = EnumSet.of(Stage.ASSIGNED, Stage.PICKED_UP, Stage.ON_THE_WAY);

    public void saveLocation(Long orderId, UpdateLocation request, String actorEmail) {
        if (request.getLat() == null || request.getLat() < -90 || request.getLat() > 90
                || request.getLng() == null || request.getLng() < -180 || request.getLng() > 180) {
            throw new IllegalArgumentException("Invalid latitude/longitude");
        }

        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException("Order not found"));

        UserEntity actor = userRepository.findByEmail(actorEmail)
                .orElseThrow(() -> new UserNotFoundException("Authenticated user not found"));

        if (order.getDriverId() == null || !order.getDriverId().getId().equals(actor.getId())) {
            throw new ForbiddenActionException("You are not the driver assigned to this order.");
        }

        if (!ACTIVE_STAGES.contains(order.getCurrentStage())) {
            throw new ForbiddenActionException("Order is not in an active stage.");
        }

        String key = "driver-location:" + orderId;
        redisTemplate.opsForValue().set(key, request);
    }

    public UpdateLocation getLocation(Long orderId) {
        String key = "driver-location:" + orderId;
        Object location = redisTemplate.opsForValue().get(key);

        if (location == null) {
            throw new LocationNotFoundException("Driver Location not found");
        }

        return (UpdateLocation) location;
    }
}
