package com.raynald.waypoint.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class LoginUserRequest {
    private String email;
    private String password;
}
