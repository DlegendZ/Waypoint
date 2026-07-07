package com.raynald.waypoint.controller;

import com.raynald.waypoint.dto.CreateUserRequest;
import com.raynald.waypoint.dto.UserResponse;
import com.raynald.waypoint.dto.LoginUserRequest;
import com.raynald.waypoint.security.JwtUtil;
import com.raynald.waypoint.service.AuthService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
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

    @PostMapping("/register")
    public ResponseEntity<UserResponse> registerUser(@RequestBody CreateUserRequest request) {
        UserResponse response = authService.registerUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<UserResponse> loginUser(@RequestBody LoginUserRequest request, HttpServletResponse servletResponse) {
        UserResponse response = authService.loginUser(request);

        ResponseCookie cookie = ResponseCookie.from("token", jwtUtil.generateToken(response.getEmail(), response.getRole()))
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(Duration.ofMillis(jwtUtil.getExpirationMs()))
                .sameSite("Lax")
                .build();

        servletResponse.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        return ResponseEntity.ok(response);
    }
}
