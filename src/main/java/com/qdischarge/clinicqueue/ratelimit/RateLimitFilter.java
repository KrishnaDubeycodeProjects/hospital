package com.qdischarge.clinicqueue.ratelimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qdischarge.clinicqueue.config.AppProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Guards the endpoints most worth protecting from abuse: admin login
 * (brute force), patient token creation, and the public WhatsApp webhook.
 * Everything else is left unthrottled, matching the original's behavior.
 *
 * Deliberately not a @Component: it's wired into SecurityConfig's filter
 * chain explicitly (see SecurityConfig#rateLimitFilter) so it runs exactly
 * once per request instead of also being auto-registered as a
 * container-level servlet filter.
 */
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    private final RateLimiterService rateLimiterService;
    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;

    private static final Duration WINDOW = Duration.ofMinutes(1);

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                     @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        String method = request.getMethod();

        Integer limit = null;
        String bucket = null;

        if ("POST".equals(method) && path.equals("/api/queue/login")) {
            limit = appProperties.getRateLimitLoginPerMinute();
            bucket = "login";
        } else if ("POST".equals(method) && path.equals("/api/queue")) {
            limit = appProperties.getRateLimitCreateTokenPerMinute();
            bucket = "create-token";
        } else if ("POST".equals(method) && path.equals("/webhook/whatsapp")) {
            limit = appProperties.getRateLimitWebhookPerMinute();
            bucket = "webhook";
        } else if ("POST".equals(method) && (path.equals("/api/auth/otp/send") || path.equals("/api/auth/otp/verify"))) {
            limit = appProperties.getRateLimitOtpPerMinute();
            bucket = "otp";
        }

        if (limit != null) {
            String key = bucket + ":" + clientIp(request);
            if (!rateLimiterService.tryAcquire(key, limit, WINDOW)) {
                writeTooManyRequests(response);
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private String clientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private void writeTooManyRequests(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", false);
        body.put("message", "Too many requests. Please slow down and try again shortly.");
        objectMapper.writeValue(response.getWriter(), body);
    }
}
