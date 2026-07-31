package com.raynald.waypoint.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.raynald.waypoint.AbstractIntegrationTest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class OrderControllerIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private ObjectMapper objectMapper;

    private String uniqueEmail(String prefix) {
        return prefix + "-" + UUID.randomUUID() + "@example.com";
    }

    private Cookie registerAndLogin(String email, String role) throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "name", "Test User", "email", email, "password", "password123", "role", role))));

        var result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", "password123"))))
                .andExpect(status().isOk())
                .andReturn();

        return result.getResponse().getCookie("token");
    }

    @Test
    void createOrder_withNoDriversOnline_staysCreatedNotAssigned() throws Exception {
        Cookie cookie = registerAndLogin(uniqueEmail("customer"), "CUSTOMER");

        mockMvc.perform(post("/api/orders")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "pickUpLat", -6.2000, "pickUpLng", 106.8000,
                                "dropOffLat", -6.1800, "dropOffLng", 106.8200))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.currentStage").value("CREATED"))
                .andExpect(jsonPath("$.driverId").doesNotExist());
    }

    @Test
    void createOrder_asDriver_isForbidden() throws Exception {
        // SRD 6.1: POST /orders is Role: Customer.
        Cookie cookie = registerAndLogin(uniqueEmail("driver"), "DRIVER");

        mockMvc.perform(post("/api/orders")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "pickUpLat", -6.2000, "pickUpLng", 106.8000,
                                "dropOffLat", -6.1800, "dropOffLng", 106.8200))))
                .andExpect(status().isForbidden());
    }

    @Test
    void createOrder_withoutAuth_isRejected() throws Exception {
        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "pickUpLat", -6.2000, "pickUpLng", 106.8000,
                                "dropOffLat", -6.1800, "dropOffLng", 106.8200))))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void createOrder_withInvalidCoordinates_isBadRequest() throws Exception {
        Cookie cookie = registerAndLogin(uniqueEmail("customer"), "CUSTOMER");

        mockMvc.perform(post("/api/orders")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "pickUpLat", 999.0, "pickUpLng", 106.8000,
                                "dropOffLat", -6.1800, "dropOffLng", 106.8200))))
                .andExpect(status().isBadRequest());
    }
}
