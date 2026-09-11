package com.raynald.waypoint.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.raynald.waypoint.AbstractIntegrationTest;
import com.raynald.waypoint.entity.UserEntity;
import com.raynald.waypoint.enums.Role;
import com.raynald.waypoint.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end REST flow the web client relies on: driver reports a position, customer orders,
 * nearest-driver match, ownership-checked reads, stage transitions, history, and the dispatcher views.
 */
class OrderLifecycleIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String uniqueEmail(String prefix) {
        return prefix + "-" + UUID.randomUUID() + "@example.com";
    }

    private Cookie registerAndLogin(String email, String role) throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "name", "Test " + role, "email", email, "password", "password123", "role", role))));
        return login(email);
    }

    private Cookie login(String email) throws Exception {
        return mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", "password123"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getCookie("token");
    }

    private JsonNode json(String body) throws Exception {
        return objectMapper.readTree(body);
    }

    // Each test works around its own random spot so drivers left online by other tests are never nearer.
    private double[] randomSpot() {
        return new double[]{ThreadLocalRandom.current().nextDouble(-60, 60), ThreadLocalRandom.current().nextDouble(-170, 170)};
    }

    private Cookie onlineDriverAt(double lat, double lng) throws Exception {
        Cookie driver = registerAndLogin(uniqueEmail("driver"), "DRIVER");
        mockMvc.perform(patch("/api/drivers/me/status").cookie(driver)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("updatedStatus", "ONLINE_AVAILABLE", "lat", lat, "lng", lng))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ONLINE_AVAILABLE"))
                .andExpect(jsonPath("$.currentLat").value(lat));
        return driver;
    }

    private long createOrder(Cookie customer, double lat, double lng) throws Exception {
        String body = mockMvc.perform(post("/api/orders").cookie(customer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "pickUpLat", lat, "pickUpLng", lng,
                                "dropOffLat", lat + 0.02, "dropOffLng", lng + 0.02))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json(body).get("id").asLong();
    }

    private void moveTo(Cookie actor, long orderId, String stage) throws Exception {
        mockMvc.perform(patch("/api/orders/" + orderId + "/status").cookie(actor)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("updatedStage", stage))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentStage").value(stage));
    }

    @Test
    void driverReportingLocation_getsMatched_andFullLifecycleIsReadable() throws Exception {
        double[] spot = randomSpot();
        Cookie driver = onlineDriverAt(spot[0], spot[1]);
        Cookie customer = registerAndLogin(uniqueEmail("customer"), "CUSTOMER");

        long orderId = createOrder(customer, spot[0], spot[1]);

        mockMvc.perform(get("/api/orders/" + orderId).cookie(customer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentStage").value("ASSIGNED"))
                .andExpect(jsonPath("$.driverName").value("Test DRIVER"));

        mockMvc.perform(get("/api/drivers/me").cookie(driver))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ONLINE_BUSY"));

        String driverOrders = mockMvc.perform(get("/api/orders").cookie(driver))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(json(driverOrders).get(0).get("id").asLong()).isEqualTo(orderId);

        moveTo(driver, orderId, "PICKED_UP");
        moveTo(driver, orderId, "ON_THE_WAY");
        moveTo(driver, orderId, "DELIVERED");

        mockMvc.perform(get("/api/drivers/me").cookie(driver))
                .andExpect(jsonPath("$.status").value("ONLINE_AVAILABLE"));

        mockMvc.perform(get("/api/orders/" + orderId + "/history").cookie(customer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order.currentStage").value("DELIVERED"))
                .andExpect(jsonPath("$.stages.length()").value(4))
                .andExpect(jsonPath("$.stages[0].toStage").value("ASSIGNED"))
                .andExpect(jsonPath("$.stages[3].toStage").value("DELIVERED"));
    }

    @Test
    void otherCustomer_cannotReadSomeoneElsesOrder() throws Exception {
        double[] spot = randomSpot();
        Cookie owner = registerAndLogin(uniqueEmail("owner"), "CUSTOMER");
        Cookie stranger = registerAndLogin(uniqueEmail("stranger"), "CUSTOMER");
        long orderId = createOrder(owner, spot[0], spot[1]);

        mockMvc.perform(get("/api/orders/" + orderId).cookie(stranger)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/orders/" + orderId + "/history").cookie(stranger)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/orders/" + orderId + "/location").cookie(stranger)).andExpect(status().isForbidden());

        String strangerOrders = mockMvc.perform(get("/api/orders").cookie(stranger))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(json(strangerOrders)).isEmpty();
    }

    @Test
    void customer_canCancelOwnUnassignedOrder_butNotAdvanceIt() throws Exception {
        double[] spot = randomSpot();
        Cookie customer = registerAndLogin(uniqueEmail("customer"), "CUSTOMER");
        long orderId = createOrder(customer, spot[0], spot[1]);

        mockMvc.perform(patch("/api/orders/" + orderId + "/status").cookie(customer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("updatedStage", "ASSIGNED"))))
                .andExpect(status().isForbidden());

        moveTo(customer, orderId, "CANCELLED");
    }

    @Test
    void cancellingAssignedOrder_freesTheDriver() throws Exception {
        double[] spot = randomSpot();
        Cookie driver = onlineDriverAt(spot[0], spot[1]);
        Cookie customer = registerAndLogin(uniqueEmail("customer"), "CUSTOMER");
        long orderId = createOrder(customer, spot[0], spot[1]);

        moveTo(customer, orderId, "CANCELLED");

        mockMvc.perform(get("/api/drivers/me").cookie(driver))
                .andExpect(jsonPath("$.status").value("ONLINE_AVAILABLE"));
    }

    @Test
    void dispatcher_seesOverviewDriversAndAllOrders() throws Exception {
        String email = uniqueEmail("dispatcher");
        userRepository.save(UserEntity.builder()
                .name("Test Dispatcher").email(email)
                .passwordHash(passwordEncoder.encode("password123"))
                .role(Role.DISPATCHER).build());
        Cookie dispatcher = login(email);

        double[] spot = randomSpot();
        onlineDriverAt(spot[0], spot[1]);

        mockMvc.perform(get("/api/dispatch/overview").cookie(dispatcher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.driverByStatus").exists())
                .andExpect(jsonPath("$.flaggedOrders").isArray());

        // Second call is served from the Redis cache - must deserialize cleanly too.
        mockMvc.perform(get("/api/dispatch/overview").cookie(dispatcher)).andExpect(status().isOk());

        mockMvc.perform(get("/api/dispatch/drivers").cookie(dispatcher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").isNumber());

        mockMvc.perform(get("/api/orders").cookie(dispatcher)).andExpect(status().isOk());
    }

    @Test
    void me_returnsSignedInUser_andLogoutClearsCookie() throws Exception {
        String email = uniqueEmail("customer");
        Cookie customer = registerAndLogin(email, "CUSTOMER");

        mockMvc.perform(get("/api/auth/me").cookie(customer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email));

        mockMvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/orders")).andExpect(status().isUnauthorized());

        Cookie cleared = mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isNoContent())
                .andReturn().getResponse().getCookie("token");
        assertThat(cleared).isNotNull();
        assertThat(cleared.getMaxAge()).isZero();
    }
}
