package com.raynald.waypoint.util;

import java.time.LocalDateTime;
import java.time.ZoneId;

public class TimeUtil {

    /**
     * Entities store server-local LocalDateTime. Serialising it with the server's offset
     * (e.g. "2026-09-11T08:00:00Z") keeps clients in other time zones from misreading it.
     */
    public static String toIso(LocalDateTime dateTime) {
        if (dateTime == null) {
            return null;
        }
        return dateTime.atZone(ZoneId.systemDefault()).toOffsetDateTime().toString();
    }
}
