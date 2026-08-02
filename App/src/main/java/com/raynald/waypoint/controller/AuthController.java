package com.raynald.waypoint.controller;

import com.raynald.waypoint.dto.CreateUserRequest;
import com.raynald.waypoint.dto.ErrorResponse;
import com.raynald.waypoint.dto.UserResponse;
import com.raynald.waypoint.dto.LoginUserRequest;
import com.raynald.waypoint.security.JwtUtil;
import com.raynald.waypoint.service.AuthService;
import com.raynald.waypoint.service.RateLimiterService;
import com.raynald.waypoint.util.ClientIpUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final JwtUtil jwtUtil;
    private final RateLimiterService rateLimiterService;

    @Value("${COOKIE_SECURE:false}")
    private boolean cookieSecure;

    @PostMapping("/register")
    public ResponseEntity<UserResponse> registerUser(@Valid @RequestBody CreateUserRequest request) {
        UserResponse response = authService.registerUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@Valid @RequestBody LoginUserRequest request, HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        String ip = ClientIpUtil.resolve(servletRequest);

        RateLimiterService.RateLimitResult ipLimit = rateLimiterService.checkIpLimit(ip);
        if (!ipLimit.allowed()) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header(HttpHeaders.RETRY_AFTER, String.valueOf(ipLimit.retryAfterSeconds()))
                    .body(new ErrorResponse("Too many login attempts. Try again in " + ipLimit.retryAfterSeconds() + "s."));
        }

        UserResponse response = authService.loginUser(request);

        ResponseCookie cookie = ResponseCookie.from("token", jwtUtil.generateToken(response.getEmail(), response.getRole()))
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .maxAge(Duration.ofMillis(jwtUtil.getExpirationMs()))
                .sameSite("Lax")
                .build();

        servletResponse.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        return ResponseEntity.ok(response);
    }
}
