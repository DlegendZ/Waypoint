package com.raynald.waypoint.service;

import com.raynald.waypoint.dto.LocationBroadcastResponse;
import com.raynald.waypoint.dto.UpdateLocationRequest;
import com.raynald.waypoint.entity.OrderEntity;
import com.raynald.waypoint.entity.UserEntity;
import com.raynald.waypoint.enums.Stage;
import com.raynald.waypoint.exception.ForbiddenActionException;
import com.raynald.waypoint.exception.LocationNotFoundException;
import com.raynald.waypoint.exception.OrderNotFoundException;
import com.raynald.waypoint.exception.UserNotFoundException;
import com.raynald.waypoint.repository.DriverProfileRepository;
import com.raynald.waypoint.repository.OrderRepository;
import com.raynald.waypoint.repository.UserRepository;
import com.raynald.waypoint.util.GeoLocationHelper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class DriverLocationService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final DriverProfileRepository driverProfileRepository;
    private final LocationHistoryService locationHistoryService;

    @Value("${properties.vehicle.speed}")
    private Integer speed;

    private static final Set<Stage> ACTIVE_STAGES = EnumSet.of(Stage.ASSIGNED, Stage.PICKED_UP, Stage.ON_THE_WAY);

    public void saveLocation(Long orderId, UpdateLocationRequest request, String actorEmail) {
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

        locationHistoryService.saveLocationHistory(order, request);

        driverProfileRepository.findByUserId(actor).ifPresent(profile -> {
            profile.setCurrentLat(request.getLat());
            profile.setCurrentLng(request.getLng());
            driverProfileRepository.save(profile);
        });
    }

    public LocationBroadcastResponse getLocation(Long orderId) {
        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException("Order not found"));

        String key = "driver-location:" + orderId;
        Object result = redisTemplate.opsForValue().get(key);

        if (result == null) {
            throw new LocationNotFoundException("Driver Location not found");
        }

        UpdateLocationRequest location = (UpdateLocationRequest) result;

        boolean headingToPickup = order.getCurrentStage() == Stage.ASSIGNED;
        Double targetLat = headingToPickup ? order.getPickUpLat() : order.getDropOffLat();
        Double targetLng = headingToPickup ? order.getPickUpLng() : order.getDropOffLng();

        Double distance = GeoLocationHelper.haversine(targetLat, targetLng, location.getLat(), location.getLng());

        Integer eta = (int) Math.round((distance / speed) * 60);

        return LocationBroadcastResponse.builder()
                .lat(location.getLat())
                .lng(location.getLng())
                .eta(eta)
                .distance(distance)
                .timestamp(String.valueOf(Instant.now().getEpochSecond()))
                .build();
    }
}
