package com.raynald.waypoint.service;

import com.raynald.waypoint.dto.UpdateLocation;
import com.raynald.waypoint.exception.LocationNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DriverLocationService {

    private final RedisTemplate<String, Object> redisTemplate;

    public void saveLocation(Long orderId, UpdateLocation request) {
        String key = "driver-location:" + orderId;
        redisTemplate.opsForValue().set(key, request);
    }

    public UpdateLocation getLocation(Long orderId) {
        String key = "driver-location:" + orderId;
        Object location = redisTemplate.opsForValue().get(key);

        if (location == null) {
            throw new LocationNotFoundException("Driver Location not found");
        }

        return (UpdateLocation) location;
    }
}
