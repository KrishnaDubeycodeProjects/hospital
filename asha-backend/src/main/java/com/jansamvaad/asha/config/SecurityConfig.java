package com.jansamvaad.asha.config;

import com.jansamvaad.asha.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Security config for the ASHA backend.
 * ASHA workers authenticate via the main backend's OTP system (same JWT_SECRET).
 * This backend just validates existing tokens.
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final AppProperties appProperties;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(401);
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    Map<String, Object> body = new LinkedHashMap<>();
                    body.put("success", false);
                    body.put("message", "Unauthorized. Token is missing or invalid.");
                    new com.fasterxml.jackson.databind.ObjectMapper().writeValue(response.getWriter(), body);
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    response.setStatus(403);
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    Map<String, Object> body = new LinkedHashMap<>();
                    body.put("success", false);
                    body.put("message", "Forbidden. Insufficient privileges.");
                    new com.fasterxml.jackson.databind.ObjectMapper().writeValue(response.getWriter(), body);
                }))
            .authorizeHttpRequests(auth -> auth
                // Public endpoints
                .requestMatchers("/actuator/health/**").permitAll()
                .requestMatchers("/api/asha/register", "/api/anm/register").permitAll()
                .requestMatchers("/api/surveys/templates/**", "/api/surveys/categories").permitAll()

                // ASHA worker endpoints — accept PATIENT tokens (phone-based OTP auth)
                .requestMatchers("/api/asha/**").hasAnyRole("PATIENT", "DOCTOR", "ADMIN")
                .requestMatchers("/api/surveys/**").hasAnyRole("PATIENT", "DOCTOR", "ADMIN")
                .requestMatchers("/api/followups/**").hasAnyRole("PATIENT", "DOCTOR", "ADMIN")
                .requestMatchers("/api/sync/**").hasAnyRole("PATIENT", "DOCTOR", "ADMIN")
                .requestMatchers("/api/send/**").hasAnyRole("PATIENT", "DOCTOR", "ADMIN")

                // ANM endpoints — accept DOCTOR tokens (ANMs auth as doctors)
                .requestMatchers("/api/anm/**").hasAnyRole("PATIENT", "DOCTOR", "ADMIN")

                // CHO analytics — admin only
                .requestMatchers("/api/cho/**").hasAnyRole("ADMIN", "DOCTOR")

                .anyRequest().permitAll())
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("*"));
        config.setAllowCredentials(false);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
