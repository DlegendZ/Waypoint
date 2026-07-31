package com.raynald.waypoint.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.raynald.waypoint.AbstractIntegrationTest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AuthControllerIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private ObjectMapper objectMapper;

    private String uniqueEmail() {
        return "user-" + UUID.randomUUID() + "@example.com";
    }

    private MvcResult register(String email, String password, String role) throws Exception {
        return mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Test User",
                                "email", email,
                                "password", password,
                                "role", role))))
                .andReturn();
    }

    @Test
    void register_thenLogin_setsAuthCookie() throws Exception {
        String email = uniqueEmail();
        register(email, "password123", "CUSTOMER").getResponse();

        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", "password123"))))
                .andExpect(status().isOk())
                .andReturn();

        Cookie token = loginResult.getResponse().getCookie("token");
        assertThat(token).isNotNull();
        assertThat(token.isHttpOnly()).isTrue();
    }

    @Test
    void register_duplicateEmail_isConflict() throws Exception {
        String email = uniqueEmail();
        register(email, "password123", "CUSTOMER");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Test User", "email", email, "password", "password123", "role", "CUSTOMER"))))
                .andExpect(status().isConflict());
    }

    @Test
    void register_asDispatcher_isRejected() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Test User", "email", uniqueEmail(), "password", "password123", "role", "DISPATCHER"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void login_wrongPassword_andUnknownEmail_giveTheSameResponse() throws Exception {
        String email = uniqueEmail();
        register(email, "password123", "CUSTOMER");

        MvcResult wrongPassword = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", "wrong"))))
                .andExpect(status().isUnauthorized())
                .andReturn();

        MvcResult unknownEmail = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", uniqueEmail(), "password", "wrong"))))
                .andExpect(status().isUnauthorized())
                .andReturn();

        assertThat(wrongPassword.getResponse().getContentAsString())
                .isEqualTo(unknownEmail.getResponse().getContentAsString());
    }

    @Test
    void protectedEndpoint_withoutCookie_isRejected() throws Exception {
        mockMvc.perform(get("/api/dispatch/overview"))
                .andExpect(status().is4xxClientError());
    }
}
