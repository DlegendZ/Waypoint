package com.raynald.waypoint.entity;

import com.raynald.waypoint.enums.Stage;
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

    @Column(nullable = false, name = "pick_up_lat")
    private Double pickUpLat;

    @Column(nullable = false, name = "pick_up_lng")
    private Double pickUpLng;

    @Column(nullable = false, name = "drop_off_lat")
    private Double dropOffLat;

    @Column(nullable = false, name = "drop_off_lng")
    private Double dropOffLng;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, name = "current_stage")
    private Stage currentStage = Stage.CREATED;

    @CreationTimestamp
    @Column(nullable = false, updatable = false, name = "created_at")
    private LocalDateTime createdAt;
}