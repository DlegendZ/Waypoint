package com.raynald.waypoint.security;

import com.raynald.waypoint.entity.OrderEntity;
import com.raynald.waypoint.entity.UserEntity;
import com.raynald.waypoint.exception.OrderNotFoundException;
import com.raynald.waypoint.exception.UserNotFoundException;
import com.raynald.waypoint.repository.OrderRepository;
import com.raynald.waypoint.repository.UserRepository;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class JwtChannelInterceptor implements ChannelInterceptor {

    private final UserRepository userRepository;
    private final OrderRepository orderRepository;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
            String email = sessionAttributes != null ? (String) sessionAttributes.get("email") : null;
            String role = sessionAttributes != null ? (String) sessionAttributes.get("role") : null;

            if (email == null) {
                throw new JwtException("User not authenticated");
            }

            var authentication = new UsernamePasswordAuthenticationToken(
                    email, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));

            accessor.setUser(authentication);
        }

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            String destination = accessor.getDestination();

            if (destination == null) {
                throw new IllegalArgumentException("Stomp destination can't be null");
            }

            Authentication auth = (Authentication) accessor.getUser();

            if (auth == null) {
                throw new JwtException("User not authenticated");
            }

            String email = auth.getName();
            UserEntity user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new UserNotFoundException("Authenticated user not found"));

            if (destination.startsWith("/topic/order/")) {
                String[] parts = destination.substring(1).split("/");
                Long orderId = Long.parseLong(parts[2]);

                OrderEntity order = orderRepository.findById(orderId)
                        .orElseThrow(() -> new OrderNotFoundException("Order not found"));

                if (!order.getCustomerId().getId().equals(user.getId())) {
                    throw new AccessDeniedException("You are not allowed to subscribe to this order");
                }
            }
        }
        return message;
    }
}
