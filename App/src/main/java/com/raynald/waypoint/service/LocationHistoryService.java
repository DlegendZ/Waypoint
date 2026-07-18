package com.raynald.waypoint.service;

import com.raynald.waypoint.dto.UpdateLocationRequest;
import com.raynald.waypoint.entity.LocationHistoryEntity;
import com.raynald.waypoint.entity.OrderEntity;
import com.raynald.waypoint.mapper.LocationHistoryMapper;
import com.raynald.waypoint.repository.LocationHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class LocationHistoryService {

    private final LocationHistoryRepository locationHistoryRepository;
    private final LocationHistoryMapper locationHistoryMapper;

    @Async
    public void saveLocationHistory(OrderEntity orderId, UpdateLocationRequest request) {
        LocationHistoryEntity locationHistory = locationHistoryMapper.toEntity(orderId, request);
        locationHistoryRepository.save(locationHistory);
    }
}
