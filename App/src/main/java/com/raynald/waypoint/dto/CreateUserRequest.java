package com.raynald.waypoint.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class CreateUserRequest {
    private String name;
    private String email;
    private String password;
    private String role;
}
