package com.raynald.waypoint.service;

import com.raynald.waypoint.dto.DriverProfileResponse;
import com.raynald.waypoint.dto.UpdateDriverStatusRequest;
import com.raynald.waypoint.entity.DriverProfileEntity;
import com.raynald.waypoint.entity.UserEntity;
import com.raynald.waypoint.enums.Stage;
import com.raynald.waypoint.enums.Status;
import com.raynald.waypoint.exception.ForbiddenActionException;
import com.raynald.waypoint.exception.UserNotFoundException;
import com.raynald.waypoint.mapper.DriverMapper;
import com.raynald.waypoint.repository.DriverProfileRepository;
import com.raynald.waypoint.repository.OrderRepository;
import com.raynald.waypoint.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class DriverProfileService {

    private final DriverProfileRepository driverProfileRepository;
    private final UserRepository userRepository;
    private final DriverMapper driverMapper;
    private final OrderRepository orderRepository;

    private static final Set<Stage> ACTIVE_STAGES = EnumSet.of(Stage.ASSIGNED, Stage.PICKED_UP, Stage.ON_THE_WAY);

    public DriverProfileResponse getProfile(String userEmail) {
        return driverMapper.toResponse(findProfile(userEmail));
    }

    public List<DriverProfileResponse> listDrivers() {
        return driverProfileRepository.findAll().stream()
                .map(driverMapper::toResponse)
                .toList();
    }

    public DriverProfileResponse updateStatus(UpdateDriverStatusRequest request, String userEmail) {
        DriverProfileEntity driver = findProfile(userEmail);

        Status requestedStatus;
        try {
            requestedStatus = Status.valueOf(request.getUpdatedStatus().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unknown status: " + request.getUpdatedStatus());
        }

        if ((request.getLat() == null) != (request.getLng() == null)) {
            throw new IllegalArgumentException("lat and lng must be sent together");
        }

        // A driver still holding an active order (e.g. coming back after a dropped connection) is busy,
        // not available - otherwise they could be matched to a second order mid-delivery.
        if (requestedStatus == Status.ONLINE_AVAILABLE
                && !orderRepository.findByDriverIdAndCurrentStageIn(driver.getUserId(), ACTIVE_STAGES).isEmpty()) {
            requestedStatus = Status.ONLINE_BUSY;
        }

        driver.setStatus(requestedStatus);

        // The last known position is what nearest-driver matching measures from, so a driver needs a way
        // to report it before they have an order to send location pings for.
        if (request.getLat() != null) {
            driver.setCurrentLat(request.getLat());
            driver.setCurrentLng(request.getLng());
        }

        DriverProfileEntity updatedDriver = driverProfileRepository.save(driver);

        return driverMapper.toResponse(updatedDriver);
    }

    private DriverProfileEntity findProfile(String userEmail) {
        UserEntity user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new UserNotFoundException("Authenticated user not found"));

        return driverProfileRepository.findByUserId(user)
                .orElseThrow(() -> new ForbiddenActionException("You are not a driver"));
    }
}
