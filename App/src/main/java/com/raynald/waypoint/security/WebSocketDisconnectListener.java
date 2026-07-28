package com.raynald.waypoint.security;

import com.raynald.waypoint.entity.OrderEntity;
import com.raynald.waypoint.entity.UserEntity;
import com.raynald.waypoint.enums.Role;
import com.raynald.waypoint.enums.Stage;
import com.raynald.waypoint.enums.Status;
import com.raynald.waypoint.repository.DriverProfileRepository;
import com.raynald.waypoint.repository.OrderRepository;
import com.raynald.waypoint.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class WebSocketDisconnectListener {

    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final DriverProfileRepository driverProfileRepository;

    private static final Set<Stage> ACTIVE_STAGES = EnumSet.of(Stage.ASSIGNED, Stage.PICKED_UP, Stage.ON_THE_WAY);

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        Principal principal = event.getUser();
        if (principal == null) {
            return;
        }

        UserEntity user = userRepository.findByEmail(principal.getName()).orElse(null);
        if (user == null || user.getRole() != Role.DRIVER) {
            return;
        }

        driverProfileRepository.findByUserId(user).ifPresent(profile -> {
            profile.setStatus(Status.OFFLINE);
            driverProfileRepository.save(profile);
        });

        List<OrderEntity> activeOrders = orderRepository.findByDriverIdAndCurrentStageIn(user, ACTIVE_STAGES);

        for (OrderEntity order : activeOrders) {
            order.setFlagged(true);
            order.setFlagReason("Driver disconnected mid-order");
            order.setFlaggedAt(LocalDateTime.now());
        }

        orderRepository.saveAll(activeOrders);
    }
}
