package com.raynald.waypoint.service;

import com.raynald.waypoint.mapper.UserMapper;
import com.raynald.waypoint.dto.CreateUserRequest;
import com.raynald.waypoint.dto.UserResponse;
import com.raynald.waypoint.dto.LoginUserRequest;
import com.raynald.waypoint.entity.UserEntity;
import com.raynald.waypoint.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserMapper userMapper;

    public UserResponse registerUser(CreateUserRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new RuntimeException("Email already registered.");
        }

        String password_hash = passwordEncoder.encode(request.getPassword());
        request.setPassword(password_hash);

        UserEntity user = userMapper.toEntity(request);
        UserEntity saved_user = userRepository.save(user);

        return userMapper.toResponse(saved_user);
    }

    public UserResponse loginUser(LoginUserRequest request) {
        UserEntity user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Email not found"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword_hash())) {
            throw new RuntimeException("Wrong Password");
        }

        return userMapper.toResponse(user);
    }
}
