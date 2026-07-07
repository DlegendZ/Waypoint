package com.raynald.waypoint.service;

import com.raynald.waypoint.mapper.UserMapper;
import com.raynald.waypoint.dto.CreateUserRequest;
import com.raynald.waypoint.dto.UserResponse;
import com.raynald.waypoint.dto.LoginUserRequest;
import com.raynald.waypoint.entity.UserEntity;
import com.raynald.waypoint.exception.EmailAlreadyExistsException;
import com.raynald.waypoint.exception.InvalidCredentialsException;
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
            throw new EmailAlreadyExistsException("Email already registered.");
        }

        String requestedRole = request.getRole();
        if (requestedRole != null && requestedRole.equalsIgnoreCase("DISPATCHER")) {
            throw new IllegalArgumentException("Dispatcher accounts cannot be self-registered.");
        }

        String passwordHash = passwordEncoder.encode(request.getPassword());

        UserEntity user = userMapper.toEntity(request, passwordHash);
        UserEntity saved_user = userRepository.save(user);

        return userMapper.toResponse(saved_user);
    }

    public UserResponse loginUser(LoginUserRequest request) {
        UserEntity user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new InvalidCredentialsException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("Invalid email or password");
        }

        return userMapper.toResponse(user);
    }
}
