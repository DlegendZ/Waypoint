package com.raynald.waypoint.service;

import com.raynald.waypoint.dto.OrderResponse;
import com.raynald.waypoint.dto.UpdateOrderStatusRequest;
import com.raynald.waypoint.entity.OrderEntity;
import com.raynald.waypoint.entity.OrderStageHistoryEntity;
import com.raynald.waypoint.entity.UserEntity;
import com.raynald.waypoint.exception.OrderNotFoundException;
import com.raynald.waypoint.mapper.OrderMapper;
import com.raynald.waypoint.repository.OrderRepository;
import com.raynald.waypoint.repository.OrderStageHistoryRepository;
import com.raynald.waypoint.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final OrderMapper orderMapper;
    private final OrderStageHistoryRepository orderStageHistoryRepository;

    public boolean stateTransitionRules(String currentStage, String updatedStage) {
        List<String> stages = new ArrayList<>(List.of("CREATED", "ASSIGNED", "PICKED_UP", "ON_THE_WAY", "DELIVERED"));

        if ((currentStage.equals(stages.get(0)) || currentStage.equals(stages.get(1)) && updatedStage.equals("CANCELLED"))) {
            return true;
        }

        for (int i = 0; i < stages.size()-1; i++) {
            if (currentStage.equals(stages.get(i)) && updatedStage.equals(stages.get(i+1)) ) {
                return true;
            }
        }

        return false;
    }

    public OrderResponse updateStatus(UpdateOrderStatusRequest request) {
        OrderEntity order = orderRepository.findById(request.getOrderId())
                .orElseThrow(() -> new OrderNotFoundException("Invalid order"));

        UserEntity user = userRepository.findById(request.getActorId())
                .orElseThrow(() -> new RuntimeException("Invalid actor")); //change this into a specific exception later on

        if (stateTransitionRules(order.getCurrentStage().name(), request.getUpdatedStage()) {
            order.setCurrentStage(OrderEntity.Stage.valueOf(request.getUpdatedStage()));
            OrderEntity updated_order = orderRepository.save(order);

            OrderStageHistoryEntity order_history = orderMapper.toEntity(request, order, user);
            OrderStageHistoryEntity saved_order_history = orderStageHistoryRepository.save(order_history);

            return orderMapper.toResponse(updated_order);
        }

        throw new RuntimeException("Wrong Phase bro"); //fix the exception this one as well
    }
}
