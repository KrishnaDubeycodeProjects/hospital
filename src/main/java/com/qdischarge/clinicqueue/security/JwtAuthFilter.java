package com.qdischarge.clinicqueue.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Parses "Authorization: Bearer <jwt>" and, if valid, populates the
 * SecurityContext with a ROLE_ADMIN / ROLE_PATIENT / ROLE_DOCTOR / ROLE_ASHA /
 * ROLE_ANM / ROLE_CHO authentication (see JwtService). Field workers are identified
 * only by their OTP-issued token; the X-ASHA-Phone header is honoured as identity
 * solely when app.allow-header-identity=true (local development). The decoded token itself -- subject,
 * role, and doctorId for doctor tokens -- is stashed in the authentication's
 * "details" slot so controllers can pull it via CurrentUser without a second
 * DB lookup. Routes that don't require auth simply proceed with no
 * authentication set.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final com.qdischarge.clinicqueue.config.AppProperties appProperties;

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) return a;
        if (b != null && !b.isBlank()) return b;
        return null;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                     @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            JwtService.DecodedToken decoded = jwtService.decode(token);
            if (decoded != null) {
                var authentication = new UsernamePasswordAuthenticationToken(
                        decoded.subject(), null, List.of(new SimpleGrantedAuthority("ROLE_" + decoded.role())));
                authentication.setDetails(decoded);
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        } else if (appProperties.isAllowHeaderIdentity()) {
            // LOCAL DEVELOPMENT ONLY (app.allow-header-identity=true): accept X-ASHA-Phone /
            // X-ANM-Phone as identity without a token. Optional X-Worker-Role picks ASHA/ANM/CHO.
            // In production this branch is disabled and identity comes only from the OTP JWT.
            String phone = firstNonBlank(request.getHeader("X-ASHA-Phone"), request.getHeader("X-ANM-Phone"));
            if (phone != null) {
                String cleanPhone = com.qdischarge.clinicqueue.util.PhoneNormalizer.normalize(phone);
                String requestedRole = request.getHeader("X-Worker-Role");
                String role = requestedRole != null && JwtService.isWorkerRole(requestedRole.trim().toUpperCase())
                        ? requestedRole.trim().toUpperCase() : JwtService.ASHA_ROLE;
                JwtService.DecodedToken devToken = new JwtService.DecodedToken(cleanPhone, role, null);
                var authentication = new UsernamePasswordAuthenticationToken(
                        cleanPhone, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
                authentication.setDetails(devToken);
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        }

        filterChain.doFilter(request, response);
    }
}
