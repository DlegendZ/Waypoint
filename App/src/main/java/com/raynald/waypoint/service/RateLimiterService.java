package com.raynald.waypoint.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class RateLimiterService {

    private final RedisTemplate<String, Object> redisTemplate;

    private static final int USER_LIMIT = 10;
    private static final int IP_LIMIT = 5;
    private static final long WINDOW_SECONDS = 60;

    public RateLimitResult checkUserLimit(String userEmail) {
        return check("rate-limit:" + userEmail, USER_LIMIT);
    }

    public RateLimitResult checkIpLimit(String ip) {
        return check("rate-limit:" + ip, IP_LIMIT);
    }

    private RateLimitResult check(String key, int limit) {
        Long count = redisTemplate.opsForValue().increment(key);

        if (count != null && count == 1) {
            redisTemplate.expire(key, WINDOW_SECONDS, TimeUnit.SECONDS);
        }

        boolean allowed = count != null && count <= limit;

        Long ttl = redisTemplate.getExpire(key, TimeUnit.SECONDS);
        long retryAfterSeconds = (ttl != null && ttl > 0) ? ttl : WINDOW_SECONDS;

        return new RateLimitResult(allowed, retryAfterSeconds);
    }

    public record RateLimitResult(boolean allowed, long retryAfterSeconds) {}
}
