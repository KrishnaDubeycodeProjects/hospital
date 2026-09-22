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
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
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
@EnableMethodSecurity
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
                        .frameOptions(frame -> frame.sameOrigin())
                        .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true)))
                .authorizeHttpRequests(auth -> auth
                        // Public endpoints for WhatsApp WebViews
                        .requestMatchers("/api/wa/**", "/wa/**").permitAll()
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
                        .requestMatchers(HttpMethod.PUT, "/api/hospitals/*/departments/*/counters").hasRole("ADMIN")
                        .requestMatchers("/api/hospitals/*/doctor-join-code", "/api/hospitals/*/doctor-join-code/**").hasRole("ADMIN")
                        // Hospital assigns one of its doctors to a counter/department location.
                        .requestMatchers(HttpMethod.PUT, "/api/hospitals/*/doctors/*/location").hasRole("ADMIN")
                        // Time-slot reads (a hospital's OPD schedule) are public; opening one is admin-only.
                        .requestMatchers(HttpMethod.POST, "/api/hospitals/*/time-slots").hasRole("ADMIN")
                        // Multi-counter admin actions (complete/miss/reassign a counter).
                        .requestMatchers(HttpMethod.POST, "/api/counters/**").hasRole("ADMIN")
                        // Admin pushes a called-but-absent patient back in their own queue (exponential backoff).
                        .requestMatchers(HttpMethod.POST, "/api/queue/*/no-show").hasRole("ADMIN")
                        // Public auth endpoints: OTP and ABHA address login flows
                        .requestMatchers("/api/auth/otp/**", "/api/auth/abha/**").permitAll()
                        // Doctor registration/login prove identity via OTP (see OtpController), not a
                        // doctor JWT yet -- everything else a doctor does needs the token that returns.
                        .requestMatchers(HttpMethod.POST, "/api/doctors/register", "/api/doctors/login").permitAll()
                        .requestMatchers("/api/doctors/**").hasRole("DOCTOR")
                        // Every /api/patients/** action is self-service on the caller's own phone
                        // number (identified from the token, see CurrentUser) -- there's no "public"
                        // patient endpoint here, login *is* OtpController's /verify.
                        .requestMatchers("/api/patients/public/**").permitAll()
                        .requestMatchers("/api/patients/**").hasRole("PATIENT")
                        // Family Unit management (public lookup for booking flow, full management requires PATIENT)
                        .requestMatchers("/api/family/public/**").permitAll()
                        .requestMatchers("/api/family/**").hasRole("PATIENT")
                        // Course & Clinical Records
                        .requestMatchers("/api/courses/public/**").permitAll()
                        .requestMatchers("/api/courses/patient").hasRole("PATIENT")
                        .requestMatchers(HttpMethod.POST, "/api/courses/**").hasRole("DOCTOR")
                        .requestMatchers(HttpMethod.GET, "/api/courses/**").hasAnyRole("DOCTOR", "PATIENT", "ADMIN")
                        // Referral Engine
                        .requestMatchers("/api/referrals/public/**").permitAll()
                        .requestMatchers("/api/referrals/patient").hasRole("PATIENT")
                        .requestMatchers(HttpMethod.GET, "/api/referrals/*/qr").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/referrals/**").hasRole("DOCTOR")
                        .requestMatchers(HttpMethod.GET, "/api/referrals/**").hasAnyRole("DOCTOR", "PATIENT", "ADMIN")
                        // Drugs & ABDM open/utility APIs
                        .requestMatchers("/api/drugs/**").permitAll()
                        .requestMatchers("/api/abdm/check-address", "/api/abdm/status", "/api/abdm/kyc/**", "/api/abdm/enroll/**", "/api/abdm/callback", "/api/abdm/consent/**", "/api/abdm/patients/**").permitAll()
                        .requestMatchers("/api/abdm/**").hasAnyRole("DOCTOR", "PATIENT", "ADMIN")
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
        if (origins.contains("*")) {
            configuration.setAllowedOriginPatterns(List.of("*"));
        } else {
            configuration.setAllowedOrigins(origins);
        }
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(false);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
