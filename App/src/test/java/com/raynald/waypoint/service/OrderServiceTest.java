package com.raynald.waypoint.service;

import com.raynald.waypoint.dto.CreateOrderRequest;
import com.raynald.waypoint.entity.DriverProfileEntity;
import com.raynald.waypoint.entity.OrderEntity;
import com.raynald.waypoint.entity.OrderStageHistoryEntity;
import com.raynald.waypoint.entity.UserEntity;
import com.raynald.waypoint.enums.Stage;
import com.raynald.waypoint.enums.Status;
import com.raynald.waypoint.exception.ForbiddenActionException;
import com.raynald.waypoint.exception.InvalidStageTransitionException;
import com.raynald.waypoint.exception.OrderNotFoundException;
import com.raynald.waypoint.exception.UserNotFoundException;
import com.raynald.waypoint.mapper.OrderMapper;
import com.raynald.waypoint.repository.DriverProfileRepository;
import com.raynald.waypoint.repository.OrderRepository;
import com.raynald.waypoint.repository.OrderStageHistoryRepository;
import com.raynald.waypoint.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock private OrderRepository orderRepository;
    @Mock private UserRepository userRepository;
    @Mock private OrderMapper orderMapper;
    @Mock private OrderStageHistoryRepository orderStageHistoryRepository;
    @Mock private DriverProfileRepository driverProfileRepository;

    @InjectMocks
    private OrderService orderService;

    private UserEntity driver;
    private UserEntity customer;

    @BeforeEach
    void setUp() {
        driver = UserEntity.builder().id(1L).email("driver@example.com").build();
        customer = UserEntity.builder().id(2L).email("customer@example.com").build();
    }

    private OrderEntity orderAt(Stage stage, UserEntity assignedDriver) {
        return OrderEntity.builder()
                .id(100L)
                .customerId(customer)
                .driverId(assignedDriver)
                .currentStage(stage)
                .build();
    }

    @Test
    void updateStatus_validTransition_succeeds() {
        OrderEntity order = orderAt(Stage.ASSIGNED, driver);
        when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
        when(userRepository.findByEmail("driver@example.com")).thenReturn(Optional.of(driver));
        when(orderMapper.toEntity(eq(Stage.PICKED_UP), any(), any())).thenReturn(mock(OrderStageHistoryEntity.class));
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        orderService.updateStatus(100L, "PICKED_UP", "driver@example.com");

        assertThat(order.getCurrentStage()).isEqualTo(Stage.PICKED_UP);
        verify(orderStageHistoryRepository).save(any());
    }

    @Test
    void updateStatus_skippingStages_isRejected() {
        OrderEntity order = orderAt(Stage.CREATED, driver);
        when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
        when(userRepository.findByEmail("driver@example.com")).thenReturn(Optional.of(driver));

        assertThatThrownBy(() -> orderService.updateStatus(100L, "DELIVERED", "driver@example.com"))
                .isInstanceOf(InvalidStageTransitionException.class);
        assertThat(order.getCurrentStage()).isEqualTo(Stage.CREATED);
    }

    @Test
    void updateStatus_cancelAfterPickedUp_isRejected() {
        OrderEntity order = orderAt(Stage.PICKED_UP, driver);
        when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
        when(userRepository.findByEmail("driver@example.com")).thenReturn(Optional.of(driver));

        assertThatThrownBy(() -> orderService.updateStatus(100L, "CANCELLED", "driver@example.com"))
                .isInstanceOf(InvalidStageTransitionException.class);
    }

    @Test
    void updateStatus_cancelFromCreated_isAllowed() {
        OrderEntity order = orderAt(Stage.CREATED, driver);
        when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
        when(userRepository.findByEmail("driver@example.com")).thenReturn(Optional.of(driver));
        when(orderMapper.toEntity(eq(Stage.CANCELLED), any(), any())).thenReturn(mock(OrderStageHistoryEntity.class));
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        orderService.updateStatus(100L, "CANCELLED", "driver@example.com");

        assertThat(order.getCurrentStage()).isEqualTo(Stage.CANCELLED);
    }

    @Test
    void updateStatus_terminalStage_hasNoOutgoingTransitions() {
        OrderEntity order = orderAt(Stage.DELIVERED, driver);
        when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
        when(userRepository.findByEmail("driver@example.com")).thenReturn(Optional.of(driver));

        assertThatThrownBy(() -> orderService.updateStatus(100L, "ASSIGNED", "driver@example.com"))
                .isInstanceOf(InvalidStageTransitionException.class);
    }

    @Test
    void updateStatus_unknownStageString_isRejectedCleanly() {
        OrderEntity order = orderAt(Stage.ASSIGNED, driver);
        when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
        when(userRepository.findByEmail("driver@example.com")).thenReturn(Optional.of(driver));

        assertThatThrownBy(() -> orderService.updateStatus(100L, "TELEPORTED", "driver@example.com"))
                .isInstanceOf(InvalidStageTransitionException.class);
    }

    @Test
    void updateStatus_actorNotAssignedDriver_isForbidden() {
        UserEntity someoneElse = UserEntity.builder().id(99L).email("someone@example.com").build();
        OrderEntity order = orderAt(Stage.ASSIGNED, driver);
        when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
        when(userRepository.findByEmail("someone@example.com")).thenReturn(Optional.of(someoneElse));

        assertThatThrownBy(() -> orderService.updateStatus(100L, "PICKED_UP", "someone@example.com"))
                .isInstanceOf(ForbiddenActionException.class);
    }

    @Test
    void updateStatus_orderNotFound_throws() {
        when(orderRepository.findById(100L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orderService.updateStatus(100L, "PICKED_UP", "driver@example.com"))
                .isInstanceOf(OrderNotFoundException.class);
    }

    @Test
    void updateStatus_historyRecordsThePreMutationStage() {
        OrderEntity order = orderAt(Stage.ASSIGNED, driver);
        when(orderRepository.findById(100L)).thenReturn(Optional.of(order));
        when(userRepository.findByEmail("driver@example.com")).thenReturn(Optional.of(driver));
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AtomicReference<Stage> stageSeenByMapper = new AtomicReference<>();
        when(orderMapper.toEntity(eq(Stage.PICKED_UP), any(OrderEntity.class), any())).thenAnswer(invocation -> {
            OrderEntity o = invocation.getArgument(1);
            stageSeenByMapper.set(o.getCurrentStage());
            return mock(OrderStageHistoryEntity.class);
        });

        orderService.updateStatus(100L, "PICKED_UP", "driver@example.com");

        assertThat(stageSeenByMapper.get()).isEqualTo(Stage.ASSIGNED);
    }

    private DriverProfileEntity driverProfile(long id, Double lat, Double lng, Status status) {
        UserEntity user = UserEntity.builder().id(id).email("driver" + id + "@example.com").build();
        return DriverProfileEntity.builder().id(id).userId(user).status(status).currentLat(lat).currentLng(lng).build();
    }

    private CreateOrderRequest validRequest() {
        CreateOrderRequest request = new CreateOrderRequest();
        request.setPickUpLat(-6.2000);
        request.setPickUpLng(106.8000);
        request.setDropOffLat(-6.1800);
        request.setDropOffLng(106.8200);
        return request;
    }

    @Test
    void createOrder_picksNearestOnlineDriver() {
        DriverProfileEntity near = driverProfile(1, -6.2001, 106.8001, Status.ONLINE_AVAILABLE);
        DriverProfileEntity far = driverProfile(2, -6.5000, 107.0000, Status.ONLINE_AVAILABLE);

        when(userRepository.findByEmail("customer@example.com")).thenReturn(Optional.of(customer));
        when(driverProfileRepository.findByStatus(Status.ONLINE_AVAILABLE)).thenReturn(List.of(far, near));
        when(orderMapper.toEntity(any(), eq(customer), eq(near.getUserId())))
                .thenReturn(OrderEntity.builder().customerId(customer).driverId(near.getUserId()).build());
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(orderMapper.toResponse(any())).thenReturn(null);

        orderService.createOrder(validRequest(), "customer@example.com");

        verify(driverProfileRepository).save(argThat(p -> p.getId() == 1L && p.getStatus() == Status.ONLINE_BUSY));
    }

    @Test
    void createOrder_skipsDriversWithNoReportedLocation() {
        DriverProfileEntity noLocation = driverProfile(1, null, null, Status.ONLINE_AVAILABLE);
        DriverProfileEntity hasLocation = driverProfile(2, -6.2001, 106.8001, Status.ONLINE_AVAILABLE);

        when(userRepository.findByEmail("customer@example.com")).thenReturn(Optional.of(customer));
        when(driverProfileRepository.findByStatus(Status.ONLINE_AVAILABLE)).thenReturn(List.of(noLocation, hasLocation));
        when(orderMapper.toEntity(any(), eq(customer), eq(hasLocation.getUserId())))
                .thenReturn(OrderEntity.builder().customerId(customer).driverId(hasLocation.getUserId()).build());
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(orderMapper.toResponse(any())).thenReturn(null);

        orderService.createOrder(validRequest(), "customer@example.com");

        verify(driverProfileRepository).save(argThat(p -> p.getId() == 2L));
    }

    @Test
    void createOrder_noDriverAvailable_staysUnassignedWithoutThrowing() {
        when(userRepository.findByEmail("customer@example.com")).thenReturn(Optional.of(customer));
        when(driverProfileRepository.findByStatus(Status.ONLINE_AVAILABLE)).thenReturn(List.of());
        OrderEntity builtOrder = OrderEntity.builder().customerId(customer).build();
        when(orderMapper.toEntity(any(), eq(customer), isNull())).thenReturn(builtOrder);
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(orderMapper.toResponse(any())).thenReturn(null);

        orderService.createOrder(validRequest(), "customer@example.com");

        assertThat(builtOrder.getCurrentStage()).isEqualTo(Stage.CREATED);
        verify(driverProfileRepository, never()).save(any());
    }

    @Test
    void createOrder_invalidPickupCoordinates_throws() {
        CreateOrderRequest request = validRequest();
        request.setPickUpLat(999.0);
        when(userRepository.findByEmail("customer@example.com")).thenReturn(Optional.of(customer));

        assertThatThrownBy(() -> orderService.createOrder(request, "customer@example.com"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void createOrder_customerNotFound_throws() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orderService.createOrder(validRequest(), "ghost@example.com"))
                .isInstanceOf(UserNotFoundException.class);
    }
}
