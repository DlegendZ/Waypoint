package com.raynald.waypoint.service;

import com.raynald.waypoint.dto.OrderResponse;
import com.raynald.waypoint.entity.OrderEntity;
import com.raynald.waypoint.entity.OrderStageHistoryEntity;
import com.raynald.waypoint.entity.UserEntity;
import com.raynald.waypoint.enums.Stage;
import com.raynald.waypoint.exception.ForbiddenActionException;
import com.raynald.waypoint.exception.InvalidStageTransitionException;
import com.raynald.waypoint.exception.OrderNotFoundException;
import com.raynald.waypoint.exception.UserNotFoundException;
import com.raynald.waypoint.mapper.OrderMapper;
import com.raynald.waypoint.repository.OrderRepository;
import com.raynald.waypoint.repository.OrderStageHistoryRepository;
import com.raynald.waypoint.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final OrderMapper orderMapper;
    private final OrderStageHistoryRepository orderStageHistoryRepository;

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
}
