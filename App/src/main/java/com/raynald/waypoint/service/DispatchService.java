package com.raynald.waypoint.service;

import com.raynald.waypoint.dto.DispatchOverview;
import com.raynald.waypoint.enums.Stage;
import com.raynald.waypoint.enums.Status;
import com.raynald.waypoint.repository.DriverProfileRepository;
import com.raynald.waypoint.repository.OrderRepository;
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
            mapOrderByStage.put(Stage.valueOf((String) orderByStage[0]), (Long) orderByStage[1]);
        }

        List<Object[]> totalDriverByStatus = driverProfileRepository.countDriverProfileByStatus();

        Map<Status, Long> mapDriverByStatus = new HashMap<>();

        for (Object[] driverByStatus : totalDriverByStatus) {
            mapDriverByStatus.put(Status.valueOf((String) driverByStatus[0]), (Long) driverByStatus[1]);
        }

        return DispatchOverview.builder()
                .orderByStage(mapOrderByStage)
                .driverByStatus(mapDriverByStatus)
//                .flaggedOrders()
                .build();
    }
}
