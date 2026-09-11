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
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
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

    // "Lax" when the web client is served from the same site; "None" (plus COOKIE_SECURE=true) when it lives elsewhere.
    @Value("${COOKIE_SAME_SITE:Lax}")
    private String cookieSameSite;

    @PostMapping("/register")
    public ResponseEntity<UserResponse> registerUser(@Valid @RequestBody CreateUserRequest request) {
        UserResponse response = authService.registerUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@Valid @RequestBody LoginUserRequest request, HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        String ip = ClientIpUtil.resolve(servletRequest);

        RateLimiterService.RateLimitResult ipLimit = rateLimiterService.checkIpLimit("login", ip);
        if (!ipLimit.allowed()) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header(HttpHeaders.RETRY_AFTER, String.valueOf(ipLimit.retryAfterSeconds()))
                    .body(new ErrorResponse("Too many login attempts. Try again in " + ipLimit.retryAfterSeconds() + "s."));
        }

        UserResponse response = authService.loginUser(request);

        String token = jwtUtil.generateToken(response.getEmail(), response.getRole());
        servletResponse.addHeader(HttpHeaders.SET_COOKIE, tokenCookie(token, Duration.ofMillis(jwtUtil.getExpirationMs())).toString());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logoutUser(HttpServletResponse servletResponse) {
        // The JWT is stateless and stays valid until it expires; logging out removes it from the browser.
        servletResponse.addHeader(HttpHeaders.SET_COOKIE, tokenCookie("", Duration.ZERO).toString());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<?> currentUser(Authentication authentication) {
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ErrorResponse("Not signed in"));
        }
        return ResponseEntity.ok(authService.getCurrentUser(authentication.getName()));
    }

    private ResponseCookie tokenCookie(String value, Duration maxAge) {
        return ResponseCookie.from("token", value)
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .maxAge(maxAge)
                .sameSite(cookieSameSite)
                .build();
    }
}
