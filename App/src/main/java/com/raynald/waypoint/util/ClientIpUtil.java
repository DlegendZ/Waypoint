package com.raynald.waypoint.util;

import jakarta.servlet.http.HttpServletRequest;

public class ClientIpUtil {

    public static String resolve(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");

        if (ip == null || ip.isEmpty()) {
            ip = request.getRemoteAddr();
        }

        return ip;
    }
}
