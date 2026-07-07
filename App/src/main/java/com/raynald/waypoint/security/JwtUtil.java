package com.raynald.waypoint.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secret_key;

    @Value("${jwt.expiration-ms}")
    private Long expiration_time;

    public String generateToken(String email, String role) {
        SecretKey key = Keys.hmacShaKeyFor(secret_key.getBytes(StandardCharsets.UTF_8));

        return Jwts.builder()
                .subject(email)
                .claim("role", role)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiration_time))
                .signWith(key)
                .compact();
    }

    public long getExpirationMs() {
        return expiration_time;
    }

    public Claims extractClaims(String token) {
        SecretKey key = Keys.hmacShaKeyFor(secret_key.getBytes(StandardCharsets.UTF_8));

        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
