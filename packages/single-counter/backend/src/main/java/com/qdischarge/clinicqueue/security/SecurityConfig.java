package com.qdischarge.clinicqueue.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.ratelimit.RateLimitFilter;
import com.qdischarge.clinicqueue.ratelimit.RateLimiterService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
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

import java.util.Arrays;
import java.util.List;

/**
 * Stateless, JWT-based security for the admin-only endpoints. Everything the
 * original queue.js/webhook.js exposed without auth (patient check-in, queue
 * reads, QR generation, the WhatsApp webhook) stays public; only
 * POST /api/queue/verify and PUT /api/queue/{id} require ROLE_ADMIN, exactly
 * like the original's authenticateAdmin middleware.
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final AppProperties appProperties;
    private final JwtAuthFilter jwtAuthFilter;
    private final RestAuthenticationEntryPoint authenticationEntryPoint;
    private final RestAccessDeniedHandler accessDeniedHandler;
    private final RateLimiterService rateLimiterService;
    private final ObjectMapper objectMapper;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public RateLimitFilter rateLimitFilter() {
        return new RateLimitFilter(rateLimiterService, appProperties, objectMapper);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable()) // stateless REST API, no cookies/session
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .headers(headers -> headers
                        .contentTypeOptions(opts -> {})
                        .frameOptions(frame -> frame.deny())
                        .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true)))
                .authorizeHttpRequests(auth -> auth
                        // NOTE: JwtAuthFilter now authenticates three token kinds (ROLE_ADMIN/
                        // ROLE_PATIENT/ROLE_DOCTOR, see JwtService), so every admin-only route below
                        // must say hasRole("ADMIN") explicitly -- a bare authenticated() would also
                        // accept a valid patient or doctor token, which is not what any of these mean.
                        .requestMatchers(HttpMethod.POST, "/api/queue/verify").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/queue/*").hasRole("ADMIN")
                        // Missed-queue admin panel: staff-only search/requeue/reject over PII.
                        .requestMatchers("/api/queue/missed", "/api/queue/missed/**").hasRole("ADMIN")
                        // Per-phone visit history can span more than one patient's name/age -- staff-only.
                        .requestMatchers("/api/queue/history/**").hasRole("ADMIN")
                        // Hospital directory reads (location/URI/OPD hours) are public; creating,
                        // relocating a hospital, or reading/rotating its doctor join code are admin actions.
                        .requestMatchers(HttpMethod.POST, "/api/hospitals").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/hospitals/*/location").hasRole("ADMIN")
                        .requestMatchers("/api/hospitals/*/doctor-join-code", "/api/hospitals/*/doctor-join-code/**").hasRole("ADMIN")
                        // Multi-counter admin actions (complete/miss/reassign a counter).
                        .requestMatchers(HttpMethod.POST, "/api/counters/**").hasRole("ADMIN")
                        // Doctor registration/login prove identity via OTP (see OtpController), not a
                        // doctor JWT yet -- everything else a doctor does needs the token that returns.
                        .requestMatchers(HttpMethod.POST, "/api/doctors/register", "/api/doctors/login").permitAll()
                        .requestMatchers("/api/doctors/**").hasRole("DOCTOR")
                        // Every /api/patients/** action is self-service on the caller's own phone
                        // number (identified from the token, see CurrentUser) -- there's no "public"
                        // patient endpoint here, login *is* OtpController's /verify.
                        .requestMatchers("/api/patients/**").hasRole("PATIENT")
                        .requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
                        .requestMatchers("/actuator/**").hasRole("ADMIN")
                        .anyRequest().permitAll())
                .addFilterBefore(rateLimitFilter(), UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> origins = Arrays.stream(appProperties.getAllowedOrigins().split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        configuration.setAllowedOrigins(origins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(false);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
