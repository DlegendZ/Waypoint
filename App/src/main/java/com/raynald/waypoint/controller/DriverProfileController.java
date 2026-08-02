package com.raynald.waypoint.controller;

import com.raynald.waypoint.dto.DriverProfileResponse;
import com.raynald.waypoint.dto.UpdateDriverStatusRequest;
import com.raynald.waypoint.service.DriverProfileService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/drivers")
@SecurityRequirement(name = "cookieAuth")
public class DriverProfileController {

    private final DriverProfileService driverProfileService;

    @PatchMapping("/me/status")
    public ResponseEntity<DriverProfileResponse> updateStatus(@Valid @RequestBody UpdateDriverStatusRequest request, Authentication authentication) {
        String userEmail = authentication.getName();
        DriverProfileResponse response = driverProfileService.updateStatus(request, userEmail);
        return ResponseEntity.ok(response);
    }
}
