package com.qdischarge.clinicqueue.security;

import com.qdischarge.clinicqueue.config.AppProperties;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/** Worker identity must come from the OTP-issued JWT, never from an unverified X-ASHA-Phone header. */
class WorkerIdentityAuthTest {

    private AppProperties props;
    private JwtService jwt;
    private JwtAuthFilter filter;
    private final CurrentUser currentUser = new CurrentUser();

    @BeforeEach
    void setUp() {
        props = new AppProperties();
        props.setJwtSecret("unit-test-secret-unit-test-secret-0123456789");
        props.setJwtExpiryMinutes(60);
        props.setWorkerJwtExpiryDays(30);
        jwt = new JwtService(props);
        jwt.init();
        filter = new JwtAuthFilter(jwt, props);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
    }

    private Authentication run(MockHttpServletRequest req) throws Exception {
        SecurityContextHolder.clearContext();
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(req));
        filter.doFilter(req, new MockHttpServletResponse(), mock(FilterChain.class));
        return SecurityContextHolder.getContext().getAuthentication();
    }

    @Test
    void workerTokenRoundTripsRoleAndPhone() {
        String token = jwt.generateWorkerToken("+919876522222", JwtService.CHO_ROLE);
        JwtService.DecodedToken d = jwt.decode(token);
        assertNotNull(d);
        assertEquals("CHO", d.role());
        assertEquals("+919876522222", d.subject());
        assertThrows(IllegalArgumentException.class, () -> jwt.generateWorkerToken("+919876522222", "PATIENT"));
    }

    @Test
    void headerAloneIsNotIdentityInProduction() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("X-ASHA-Phone", "9876543210");
        assertNull(run(req), "spoofed header must not authenticate");
        assertNull(currentUser.getAshaPhone());
        assertThrows(ResponseStatusException.class, currentUser::requireAshaPhone, "no default-phone fallback");
    }

    @Test
    void verifiedWorkerTokenWinsOverMismatchedHeader() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("Authorization", "Bearer " + jwt.generateWorkerToken("+919876543210", JwtService.ASHA_ROLE));
        req.addHeader("X-ASHA-Phone", "9999999999");
        Authentication auth = run(req);
        assertNotNull(auth);
        assertTrue(auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ASHA")));
        assertEquals("+919876543210", currentUser.getAshaPhone());
        assertNull(currentUser.getChoPhone(), "an ASHA token is not a CHO identity");
    }

    @Test
    void patientTokenCannotActAsWorkerViaHeader() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("Authorization", "Bearer " + jwt.generatePatientToken("+919811111111"));
        req.addHeader("X-ASHA-Phone", "9876543210");
        run(req);
        assertNull(currentUser.getAshaPhone());
    }

    @Test
    void adminMaySelectWorkerViaHeader() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("Authorization", "Bearer " + jwt.generateAdminToken("admin"));
        req.addHeader("X-ASHA-Phone", "9876543210");
        run(req);
        assertEquals("+919876543210", currentUser.getAshaPhone());
    }

    @Test
    void headerIdentityOnlyWhenDevFlagEnabled() throws Exception {
        props.setAllowHeaderIdentity(true);
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("X-ASHA-Phone", "9876522222");
        req.addHeader("X-Worker-Role", "cho");
        Authentication auth = run(req);
        assertNotNull(auth);
        assertEquals(List.of(new SimpleGrantedAuthority("ROLE_CHO")), List.copyOf(auth.getAuthorities()));
        assertEquals("+919876522222", currentUser.getChoPhone());
    }

    @Test
    void tamperedTokenIsRejected() throws Exception {
        String token = jwt.generateWorkerToken("+919876543210", JwtService.ASHA_ROLE);
        String forged = token.substring(0, token.length() - 4) + (token.endsWith("AAAA") ? "BBBB" : "AAAA");
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("Authorization", "Bearer " + forged);
        assertNull(run(req));
        // sanity: an explicitly set non-worker authentication yields no worker phone
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("x", null, List.of()));
        assertNull(currentUser.getAshaPhone());
    }
}
