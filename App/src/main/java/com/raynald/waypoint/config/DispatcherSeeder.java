package com.raynald.waypoint.config;

import com.raynald.waypoint.entity.UserEntity;
import com.raynald.waypoint.enums.Role;
import com.raynald.waypoint.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Dispatcher accounts can't self-register, so this creates one on startup from
 * DISPATCHER_EMAIL / DISPATCHER_PASSWORD when both are set and the email isn't taken yet.
 * Leaving them unset does nothing.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DispatcherSeeder implements ApplicationRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${DISPATCHER_EMAIL:}")
    private String email;

    @Value("${DISPATCHER_PASSWORD:}")
    private String password;

    @Value("${DISPATCHER_NAME:Dispatcher}")
    private String name;

    @Override
    public void run(ApplicationArguments args) {
        if (email.isBlank() || password.isBlank()) {
            return;
        }

        if (userRepository.findByEmail(email).isPresent()) {
            return;
        }

        userRepository.save(UserEntity.builder()
                .name(name)
                .email(email)
                .passwordHash(passwordEncoder.encode(password))
                .role(Role.DISPATCHER)
                .build());
        log.info("Seeded dispatcher account {}", email);
    }
}
