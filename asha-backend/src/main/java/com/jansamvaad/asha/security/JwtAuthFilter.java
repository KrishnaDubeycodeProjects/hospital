package com.jansamvaad.asha.security;

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
 * Parses "Authorization: Bearer <jwt>" and populates SecurityContext.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

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
        } else {
            // Field App / Offline Sync fallback: header-based auth for ASHA / ANM / CHO
            String ashaPhone = request.getHeader("X-ASHA-Phone");
            String anmPhone = request.getHeader("X-ANM-Phone");
            String userRole = request.getHeader("X-User-Role");

            if (ashaPhone != null && !ashaPhone.isBlank()) {
                JwtService.DecodedToken decoded = new JwtService.DecodedToken(ashaPhone, JwtService.PATIENT_ROLE, null);
                var authentication = new UsernamePasswordAuthenticationToken(
                        ashaPhone, null, List.of(new SimpleGrantedAuthority("ROLE_" + JwtService.PATIENT_ROLE)));
                authentication.setDetails(decoded);
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } else if (anmPhone != null && !anmPhone.isBlank()) {
                JwtService.DecodedToken decoded = new JwtService.DecodedToken(anmPhone, JwtService.DOCTOR_ROLE, null);
                var authentication = new UsernamePasswordAuthenticationToken(
                        anmPhone, null, List.of(new SimpleGrantedAuthority("ROLE_" + JwtService.DOCTOR_ROLE)));
                authentication.setDetails(decoded);
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } else if ("ADMIN".equalsIgnoreCase(userRole) || "CHO".equalsIgnoreCase(userRole)) {
                JwtService.DecodedToken decoded = new JwtService.DecodedToken("admin", JwtService.ADMIN_ROLE, null);
                var authentication = new UsernamePasswordAuthenticationToken(
                        "admin", null, List.of(new SimpleGrantedAuthority("ROLE_" + JwtService.ADMIN_ROLE)));
                authentication.setDetails(decoded);
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        }

        filterChain.doFilter(request, response);
    }
}
