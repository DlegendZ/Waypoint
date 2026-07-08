package com.raynald.waypoint.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "order_stage_histories")
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Data
public class OrderStageHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "order_id", updatable = false)
    private OrderEntity OrderId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, name = "from_stage")
    private Stage fromStage;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, name = "to_stage")
    private Stage toStage;

    @CreationTimestamp
    @Column(nullable = false, updatable = false, name = "changed_at")
    private LocalDateTime changedAt;

    @ManyToOne
    @JoinColumn(name = "actor_id", updatable = false)
    private UserEntity actorId;

    public enum Stage {
        CREATED,
        ASSIGNED,
        PICKED_UP,
        ON_THE_WAY,
        DELIVERED,
        CANCELLED
    }
}
