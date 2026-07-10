package com.raynald.waypoint.entity;

import com.raynald.waypoint.enums.Status;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "driver_profiles")
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Data
public class DriverProfileEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "user_id", updatable = false)
    private UserEntity userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    @Column(nullable = false, name = "current_lat")
    private Double currentLat;

    @Column(nullable = false, name = "current_lng")
    private Double currentLng;

    @UpdateTimestamp
    @Column(nullable = false, name = "last_updated_at")
    private LocalDateTime lastUpdatedAt;
}
