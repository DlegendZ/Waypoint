package com.raynald.waypoint.service;

import com.raynald.waypoint.dto.DriverProfileResponse;
import com.raynald.waypoint.dto.UpdateDriverStatusRequest;
import com.raynald.waypoint.entity.DriverProfileEntity;
import com.raynald.waypoint.entity.UserEntity;
import com.raynald.waypoint.enums.Status;
import com.raynald.waypoint.exception.ForbiddenActionException;
import com.raynald.waypoint.exception.UserNotFoundException;
import com.raynald.waypoint.mapper.DriverMapper;
import com.raynald.waypoint.repository.DriverProfileRepository;
import com.raynald.waypoint.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DriverProfileService {

    private final DriverProfileRepository driverProfileRepository;
    private final UserRepository userRepository;
    private final DriverMapper driverMapper;

    public DriverProfileResponse updateStatus(UpdateDriverStatusRequest request, String userEmail) {
        UserEntity user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new UserNotFoundException("Authenticated user not found"));

        DriverProfileEntity driver = driverProfileRepository.findByUserId(user)
                .orElseThrow(() -> new ForbiddenActionException("You are not a driver"));

        driver.setStatus(Status.valueOf(request.getUpdatedStatus()));

        DriverProfileEntity updatedDriver = driverProfileRepository.save(driver);

        return driverMapper.toResponse(updatedDriver);
    }
}
