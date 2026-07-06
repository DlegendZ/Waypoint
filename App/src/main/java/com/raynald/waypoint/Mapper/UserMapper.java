package com.raynald.waypoint.Mapper;

import com.raynald.waypoint.dto.CreateUserRequest;
import com.raynald.waypoint.dto.CreateUserResponse;
import com.raynald.waypoint.entity.UserEntity;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {

    public UserEntity toEntity(CreateUserRequest request) {
        return UserEntity.builder()
                .name(request.getName())
                .email(request.getEmail())
                .password_hash(request.getPassword())
                .role(UserEntity.Role.valueOf(request.getRole()))
                .build();

    }

    public CreateUserResponse toResponse(UserEntity user) {
        return CreateUserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .build();
    }
}
