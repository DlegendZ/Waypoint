package com.raynald.waypoint.controller;

import com.raynald.waypoint.dto.DispatchOverview;
import com.raynald.waypoint.service.DispatchService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/dispatch")
@SecurityRequirement(name = "cookieAuth")
public class DispatchController {

    private final DispatchService dispatchService;

    @GetMapping("/overview")
    public ResponseEntity<DispatchOverview> getOverview() {
        DispatchOverview response = dispatchService.getOverview();
        return ResponseEntity.status(HttpStatus.OK).body(response);
    }
}
