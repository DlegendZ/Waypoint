package com.raynald.waypoint.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class RateLimiterService {

    private final RedisTemplate<String, Long> redisTemplate;

    public Boolean isUserAllowed(String userEmail) {
        String key = "rate-limit:" + userEmail;

        Long count = redisTemplate.opsForValue().increment(key);

        if (count != null && count == 1) {
            redisTemplate.expire(key, 60, TimeUnit.SECONDS);
        }

        return count != null && count <= 10;
    }

    public Boolean isIpAllowed(String ip) {
        String key = "rate-limit:" + ip;

        Long count = redisTemplate.opsForValue().increment(key);

        if (count != null && count == 1) {
            redisTemplate.expire(key, 60, TimeUnit.SECONDS);
        }

        return count != null && count <= 5;
    }
}
