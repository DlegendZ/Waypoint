package com.raynald.waypoint.service;

import com.raynald.waypoint.dto.CreateOrderRequest;
import com.raynald.waypoint.dto.OrderResponse;
import com.raynald.waypoint.entity.DriverProfileEntity;
import com.raynald.waypoint.entity.OrderEntity;
import com.raynald.waypoint.entity.OrderStageHistoryEntity;
import com.raynald.waypoint.entity.UserEntity;
import com.raynald.waypoint.enums.Stage;
import com.raynald.waypoint.enums.Status;
import com.raynald.waypoint.exception.ForbiddenActionException;
import com.raynald.waypoint.exception.InvalidStageTransitionException;
import com.raynald.waypoint.exception.OrderNotFoundException;
import com.raynald.waypoint.exception.UserNotFoundException;
import com.raynald.waypoint.mapper.OrderMapper;
import com.raynald.waypoint.repository.DriverProfileRepository;
import com.raynald.waypoint.repository.OrderRepository;
import com.raynald.waypoint.repository.OrderStageHistoryRepository;
import com.raynald.waypoint.repository.UserRepository;
import com.raynald.waypoint.util.HaversineUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final OrderMapper orderMapper;
    private final OrderStageHistoryRepository orderStageHistoryRepository;
    private final DriverProfileRepository driverProfileRepository;

    private static final Map<Stage, Set<Stage>> ALLOWED_TRANSITIONS =
            new EnumMap<>(Stage.class);

    static {
        ALLOWED_TRANSITIONS.put(Stage.CREATED, EnumSet.of(Stage.ASSIGNED, Stage.CANCELLED));
        ALLOWED_TRANSITIONS.put(Stage.ASSIGNED, EnumSet.of(Stage.PICKED_UP, Stage.CANCELLED));
        ALLOWED_TRANSITIONS.put(Stage.PICKED_UP, EnumSet.of(Stage.ON_THE_WAY));
        ALLOWED_TRANSITIONS.put(Stage.ON_THE_WAY, EnumSet.of(Stage.DELIVERED));
        ALLOWED_TRANSITIONS.put(Stage.DELIVERED, EnumSet.noneOf(Stage.class));
        ALLOWED_TRANSITIONS.put(Stage.CANCELLED, EnumSet.noneOf(Stage.class));
    }

    private boolean isValidTransition(Stage from, Stage to) {
        return ALLOWED_TRANSITIONS.getOrDefault(from, Set.of()).contains(to);
    }

    public OrderResponse updateStatus(Long orderId, String updatedStageRaw, String actorEmail) {
        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException("Order not found"));

        UserEntity actor = userRepository.findByEmail(actorEmail)
                .orElseThrow(() -> new UserNotFoundException("Authenticated user not found"));

        if (order.getDriverId() == null || !order.getDriverId().getId().equals(actor.getId())) {
            throw new ForbiddenActionException("You are not the driver assigned to this order.");
        }

        Stage currentStage = order.getCurrentStage();
        Stage requestedStage;
        try {
            requestedStage = Stage.valueOf(updatedStageRaw.toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new InvalidStageTransitionException("Unknown stage: " + updatedStageRaw);
        }

        if (!isValidTransition(currentStage, requestedStage)) {
            throw new InvalidStageTransitionException(
                    "Cannot move order from " + currentStage + " to " + requestedStage);
        }

        OrderStageHistoryEntity history = orderMapper.toEntity(requestedStage, order, actor);

        order.setCurrentStage(requestedStage);
        OrderEntity updatedOrder = orderRepository.save(order);
        orderStageHistoryRepository.save(history);

        return orderMapper.toResponse(updatedOrder);
    }

    public OrderResponse createOrder(CreateOrderRequest request, String customerEmail) {
        UserEntity userId = userRepository.findByEmail(customerEmail)
                .orElseThrow(() -> new UserNotFoundException("Authenticated user not found"));

        if (request.getPickUpLat() == null || request.getPickUpLat() < -90 || request.getPickUpLat() > 90
                || request.getPickUpLng() == null || request.getPickUpLng() < -180 || request.getPickUpLng() > 180) {
            throw new IllegalArgumentException("Invalid latitude/longitude");
        }

        if (request.getDropOffLat() == null || request.getDropOffLat() < -90 || request.getDropOffLat() > 90
                || request.getDropOffLng() == null || request.getDropOffLng() < -180 || request.getDropOffLng() > 180) {
            throw new IllegalArgumentException("Invalid latitude/longitude");
        }

        List<DriverProfileEntity> drivers = driverProfileRepository.findByStatus(Status.ONLINE_AVAILABLE);

        Double closest_d = null;
        DriverProfileEntity driverProfile = null;

        for (DriverProfileEntity driver : drivers) {
            if (driver.getCurrentLat() == null || driver.getCurrentLng() == null) {
                continue;
            }

            Double d = HaversineUtil.haversine(request.getPickUpLat(), request.getPickUpLng(), driver.getCurrentLat(), driver.getCurrentLng());

            if (closest_d == null || d < closest_d) {
                closest_d = d;
                driverProfile = driver;
            }
        }

        UserEntity assignedDriverUser = driverProfile != null ? driverProfile.getUserId() : null;
        OrderEntity order = orderMapper.toEntity(request, userId, assignedDriverUser);

        if (driverProfile != null) {
            order.setCurrentStage(Stage.ASSIGNED);
            driverProfile.setStatus(Status.ONLINE_BUSY);
            driverProfileRepository.save(driverProfile);
        }

        OrderEntity updated_order = orderRepository.save(order);
        return orderMapper.toResponse(updated_order);
    }
}
