package com.raynald.waypoint.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "orders")
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Data
public class OrderEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "customer_id", updatable = false)
    private UserEntity customerId;

    @ManyToOne
    @JoinColumn(name = "driver_id", updatable = false)
    private UserEntity driverId;

    @Column(nullable = false)
    private Float pickUpLat;

    @Column(nullable = false)
    private Float pickUpLng;

    @Column(nullable = false)
    private Float dropOffLat;

    @Column(nullable = false)
    private Float dropOffLng;

    @Enumerated(EnumType.STRING)
    private Stage currentStage;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public enum Stage {
        CREATED,
        ASSIGNED,
        PICKED_UP,
        ON_THE_WAY,
        DELIVERED,
        CANCELLED
    }
}