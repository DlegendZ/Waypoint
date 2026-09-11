package com.raynald.waypoint.controller;

import com.raynald.waypoint.dto.DispatchOverview;
import com.raynald.waypoint.dto.DriverProfileResponse;
import com.raynald.waypoint.service.DispatchService;
import com.raynald.waypoint.service.DriverProfileService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/dispatch")
@SecurityRequirement(name = "cookieAuth")
public class DispatchController {

    private final DispatchService dispatchService;
    private final DriverProfileService driverProfileService;

    @GetMapping("/overview")
    public ResponseEntity<DispatchOverview> getOverview() {
        DispatchOverview response = dispatchService.getOverview();
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }

    /** Every driver with their status and last known position, for the fleet map. Not cached. */
    @GetMapping("/drivers")
    public ResponseEntity<List<DriverProfileResponse>> getDrivers() {
        return ResponseEntity.ok(driverProfileService.listDrivers());
    }
}
