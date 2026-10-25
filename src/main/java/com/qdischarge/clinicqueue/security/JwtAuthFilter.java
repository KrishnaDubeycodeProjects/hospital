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
 * SecurityContext with a ROLE_ADMIN / ROLE_PATIENT / ROLE_DOCTOR
 * authentication (see JwtService). The decoded token itself -- subject,
 * role, and doctorId for doctor tokens -- is stashed in the authentication's
 * "details" slot so controllers can pull it via CurrentUser without a second
 * DB lookup. Routes that don't require auth simply proceed with no
 * authentication set.
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
        }

        filterChain.doFilter(request, response);
    }
}
