package com.qdischarge.clinicqueue.security;

import com.qdischarge.clinicqueue.config.AppProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;

class AdminAuthServiceTest {

    private PasswordEncoder passwordEncoder;
    private AppProperties appProperties;

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder();
        appProperties = new AppProperties();
        appProperties.setAdminUsername("admin");
    }

    @Test
    void testAuth_WithPlaintextPasswordConfigured() {
        appProperties.setAdminPassword("secret123");
        AdminAuthService service = new AdminAuthService(appProperties, passwordEncoder);
        service.init();

        assertTrue(service.authenticate("admin", "secret123"));
        assertFalse(service.authenticate("admin", "wrongpassword"));
        assertFalse(service.authenticate("wronguser", "secret123"));
        assertFalse(service.authenticate("admin", ""));
        assertFalse(service.authenticate("admin", null));
    }

    @Test
    void testAuth_WithBcryptHashConfigured() {
        String hash = passwordEncoder.encode("prodSecurePassword!");
        appProperties.setAdminPasswordHash(hash);
        AdminAuthService service = new AdminAuthService(appProperties, passwordEncoder);
        service.init();

        assertTrue(service.authenticate("admin", "prodSecurePassword!"));
        assertFalse(service.authenticate("admin", "wrong"));
    }

    @Test
    void testAuth_WithoutCredentials_FailsClosed() {
        appProperties.setAdminPassword(null);
        appProperties.setAdminPasswordHash(null);
        AdminAuthService service = new AdminAuthService(appProperties, passwordEncoder);
        service.init();

        assertFalse(service.authenticate("admin", "anyPassword"));
        assertFalse(service.authenticate("admin", ""));
    }
}
