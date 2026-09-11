package com.raynald.waypoint.service;

import com.raynald.waypoint.dto.LocationBroadcastResponse;
import com.raynald.waypoint.dto.OrderHistoryResponse;
import com.raynald.waypoint.dto.OrderResponse;
import com.raynald.waypoint.entity.OrderEntity;
import com.raynald.waypoint.entity.UserEntity;
import com.raynald.waypoint.enums.Role;
import com.raynald.waypoint.exception.ForbiddenActionException;
import com.raynald.waypoint.exception.OrderNotFoundException;
import com.raynald.waypoint.exception.UserNotFoundException;
import com.raynald.waypoint.mapper.LocationHistoryMapper;
import com.raynald.waypoint.mapper.OrderMapper;
import com.raynald.waypoint.repository.LocationHistoryRepository;
import com.raynald.waypoint.repository.OrderRepository;
import com.raynald.waypoint.repository.OrderStageHistoryRepository;
import com.raynald.waypoint.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Read side of orders. Every lookup is ownership-checked: a customer only ever sees their own
 * orders, a driver only the ones assigned to them, and a dispatcher sees everything.
 */
@Service
@RequiredArgsConstructor
public class OrderQueryService {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final OrderMapper orderMapper;
    private final OrderStageHistoryRepository orderStageHistoryRepository;
    private final LocationHistoryRepository locationHistoryRepository;
    private final LocationHistoryMapper locationHistoryMapper;
    private final DriverLocationService driverLocationService;

    public List<OrderResponse> listOrders(String actorEmail) {
        UserEntity actor = findActor(actorEmail);

        List<OrderEntity> orders = switch (actor.getRole()) {
            case CUSTOMER -> orderRepository.findByCustomerIdOrderByCreatedAtDesc(actor);
            case DRIVER -> orderRepository.findByDriverIdOrderByCreatedAtDesc(actor);
            case DISPATCHER -> orderRepository.findTop100ByOrderByCreatedAtDesc();
        };

        return orders.stream().map(orderMapper::toResponse).toList();
    }

    public OrderResponse getOrder(Long orderId, String actorEmail) {
        UserEntity actor = findActor(actorEmail);
        OrderEntity order = findOrder(orderId);

        if (!isOwner(order, actor) && !isAssignedDriver(order, actor) && actor.getRole() != Role.DISPATCHER) {
            throw new ForbiddenActionException("You are not allowed to view this order.");
        }

        return orderMapper.toResponse(order);
    }

    public OrderHistoryResponse getHistory(Long orderId, String actorEmail) {
        UserEntity actor = findActor(actorEmail);
        OrderEntity order = findOrder(orderId);

        if (!isOwner(order, actor) && actor.getRole() != Role.DISPATCHER) {
            throw new ForbiddenActionException("You are not allowed to view this order's history.");
        }

        return OrderHistoryResponse.builder()
                .order(orderMapper.toResponse(order))
                .stages(orderStageHistoryRepository.findByOrderIdOrderByChangedAtAscIdAsc(order).stream()
                        .map(orderMapper::toStageResponse)
                        .toList())
                .route(locationHistoryRepository.findByOrderIdOrderByRecordedAtAscIdAsc(order).stream()
                        .map(locationHistoryMapper::toRoutePoint)
                        .toList())
                .build();
    }

    public LocationBroadcastResponse getLatestLocation(Long orderId, String actorEmail) {
        UserEntity actor = findActor(actorEmail);
        OrderEntity order = findOrder(orderId);

        if (!isOwner(order, actor) && !isAssignedDriver(order, actor) && actor.getRole() != Role.DISPATCHER) {
            throw new ForbiddenActionException("You are not allowed to view this order's location.");
        }

        return driverLocationService.getLocation(orderId);
    }

    private UserEntity findActor(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException("Authenticated user not found"));
    }

    private OrderEntity findOrder(Long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new OrderNotFoundException("Order not found"));
    }

    private boolean isOwner(OrderEntity order, UserEntity actor) {
        return order.getCustomerId() != null && order.getCustomerId().getId().equals(actor.getId());
    }

    private boolean isAssignedDriver(OrderEntity order, UserEntity actor) {
        return order.getDriverId() != null && order.getDriverId().getId().equals(actor.getId());
    }
}
