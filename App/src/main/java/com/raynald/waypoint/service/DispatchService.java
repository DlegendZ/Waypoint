package com.raynald.waypoint.service;

import com.raynald.waypoint.dto.DispatchOverview;
import com.raynald.waypoint.dto.FlaggedOrder;
import com.raynald.waypoint.entity.OrderEntity;
import com.raynald.waypoint.enums.Stage;
import com.raynald.waypoint.enums.Status;
import com.raynald.waypoint.repository.DriverProfileRepository;
import com.raynald.waypoint.repository.OrderRepository;
import com.raynald.waypoint.util.TimeUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DispatchService {

    private final DriverProfileRepository driverProfileRepository;
    private final OrderRepository orderRepository;

    @Cacheable(value = "dispatchOverview", key = "'overviewStats'")
    public DispatchOverview getOverview() {
        List<Object[]> totalOrderByStage = orderRepository.countOrderByStage();

        Map<Stage, Long> mapOrderByStage = new HashMap<>();

        for (Object[] orderByStage : totalOrderByStage) {
            mapOrderByStage.put(toEnum(Stage.class, orderByStage[0]), (Long) orderByStage[1]);
        }

        List<Object[]> totalDriverByStatus = driverProfileRepository.countDriverProfileByStatus();

        Map<Status, Long> mapDriverByStatus = new HashMap<>();

        for (Object[] driverByStatus : totalDriverByStatus) {
            mapDriverByStatus.put(toEnum(Status.class, driverByStatus[0]), (Long) driverByStatus[1]);
        }

        List<FlaggedOrder> flaggedOrders = orderRepository.findByFlaggedTrue().stream()
                .map(this::toFlaggedOrder)
                .toList();

        return DispatchOverview.builder()
                .orderByStage(mapOrderByStage)
                .driverByStatus(mapDriverByStatus)
                .flaggedOrders(flaggedOrders)
                .build();
    }

    // JPQL "SELECT o.currentStage" hands back the enum itself (not its name), so a plain (String) cast fails.
    private static <E extends Enum<E>> E toEnum(Class<E> type, Object value) {
        return type.isInstance(value) ? type.cast(value) : Enum.valueOf(type, value.toString());
    }

    private FlaggedOrder toFlaggedOrder(OrderEntity order) {
        return FlaggedOrder.builder()
                .orderId(order.getId())
                .reason(order.getFlagReason())
                .flaggedAt(TimeUtil.toIso(order.getFlaggedAt()))
                .build();
    }
}
