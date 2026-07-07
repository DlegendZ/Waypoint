package com.raynald.waypoint.mapper;

import com.raynald.waypoint.dto.CreateUserRequest;
import com.raynald.waypoint.dto.UserResponse;
import com.raynald.waypoint.entity.UserEntity;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {

    public UserEntity toEntity(CreateUserRequest request, String passwordHash) {
        return UserEntity.builder()
                .name(request.getName())
                .email(request.getEmail())
                .passwordHash(passwordHash)
                .role(UserEntity.Role.valueOf(request.getRole().toUpperCase()))
                .build();
    }

    public UserResponse toResponse(UserEntity user) {
        return UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .build();
    }
}
