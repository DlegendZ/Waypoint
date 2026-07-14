package com.raynald.waypoint.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtCookieChannelInterceptor implements ChannelInterceptor {

    private final JwtUtil jwtUtil;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String cookieHeader = accessor.getFirstNativeHeader("Cookie");
            System.out.println("Cookie header: " + cookieHeader);

            if (cookieHeader == null) {
                System.out.println("Cookie header NULL - client nggak kirim cookie");
                throw new JwtException("User not authenticated");
            }

            String token = extractTokenFromCookie(cookieHeader);

            if (token == null) {
                throw new JwtException("User not authenticated");
            }

            Claims claims = jwtUtil.extractClaims(token);
            String email = claims.getSubject();
            String role = claims.get("role", String.class);

            var authentication = new UsernamePasswordAuthenticationToken(
                    email, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));

            accessor.setUser(authentication);
        }
        return message;
    }

    public String extractTokenFromCookie(String cookieHeader) {
        for (String cookie : cookieHeader.split(";")) {
            String[] parts = cookie.trim().split("=",2);
            if (parts.length == 2 && "token".equals(parts[0])) {
                return parts[1];
            }
        }
        return null;
    }
}
