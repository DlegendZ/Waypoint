package com.raynald.waypoint.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "Location_histories")
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Data
public class LocationHistoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "order_id", updatable = false)
    private OrderEntity orderId;

    @Column(nullable = false)
    private Double lat;

    @Column(nullable = false)
    private Double lng;

    @UpdateTimestamp
    @Column(nullable = false, name = "recorded_at")
    private LocalDateTime recordedAt;
}
