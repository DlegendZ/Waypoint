package com.raynald.waypoint.model;

import java.time.Instant;

public record DriverLocationSnapshot(Double lat, Double lng, Instant timestamp) {
}
