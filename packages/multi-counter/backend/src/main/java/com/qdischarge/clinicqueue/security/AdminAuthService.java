package com.qdischarge.clinicqueue.security;

import com.qdischarge.clinicqueue.config.AppProperties;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Objects;

/**
 * Resolves the effective admin credential check. Prefers ADMIN_PASSWORD_HASH
 * (a pre-computed BCrypt hash, the right choice for production); falls back
 * to hashing the plaintext ADMIN_PASSWORD once at startup for local/dev use
 * so the original .env-style config keeps working. Either way, the actual
 * login comparison is a constant-time BCrypt match, never a plaintext ==.
 */
@Service
@RequiredArgsConstructor
public class AdminAuthService {

    private final AppProperties appProperties;
    private final PasswordEncoder passwordEncoder;

    private String effectiveHash;

    @PostConstruct
    void init() {
        String configuredHash = appProperties.getAdminPasswordHash();
        if (configuredHash != null && !configuredHash.isBlank()) {
            effectiveHash = configuredHash;
        } else {
            String plaintext = appProperties.getAdminPassword() != null ? appProperties.getAdminPassword() : "";
            effectiveHash = passwordEncoder.encode(plaintext);
        }
    }

    public boolean authenticate(String username, String password) {
        if (username == null || password == null) {
            return false;
        }
        boolean usernameMatches = Objects.equals(username, appProperties.getAdminUsername());
        boolean passwordMatches = passwordEncoder.matches(password, effectiveHash);
        return usernameMatches && passwordMatches;
    }
}
