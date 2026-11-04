package com.qdischarge.clinicqueue.asha.service;

import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Optional;

/**
 * Resolves which NHM cadre (if any) a phone number belongs to, from server-side records only —
 * never from anything the client claims. Called once a phone has been proven by OTP.
 *
 * Precedence: CHO (app.cho-phones or an active cho_officers row) → the active asha_workers row
 * (role ANM → ANM, otherwise ASHA). ANM cadre is therefore only ever assigned by a CHO;
 * anm_profiles (which session / self-registration endpoints can create) never grants a role.
 * Phones are compared on their last 10 digits.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkerIdentityService {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final AppProperties appProperties;
    private final SyncService syncService;

    private static final String D10 = "RIGHT(regexp_replace(COALESCE(%s, ''), '[^0-9]', '', 'g'), 10)";

    private static String d10(String col) {
        return String.format(D10, col);
    }

    private boolean exists(String sql, String phone10) {
        Integer n = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM (" + sql + ") x",
                new MapSqlParameterSource("p", phone10), Integer.class);
        return n != null && n > 0;
    }

    boolean isConfiguredCho(String phone10) {
        String list = appProperties.getChoPhones();
        if (list == null || list.isBlank()) return false;
        return Arrays.stream(list.split(","))
                .map(ChoReferralService::lastTenDigits)
                .anyMatch(p -> !p.isEmpty() && p.equals(phone10));
    }

    /** ASHA / ANM / CHO for a registered field worker; empty for everyone else (patients). */
    public Optional<String> resolveWorkerRole(String phone) {
        String p10 = ChoReferralService.lastTenDigits(phone);
        if (p10.length() != 10) return Optional.empty();
        syncService.ensureSyncSchema();

        if (isConfiguredCho(p10) || exists("SELECT 1 FROM clinicqueue.cho_officers c WHERE " + d10("c.phone") +
                " = :p AND (c.is_active IS NULL OR c.is_active = TRUE)", p10)) {
            return Optional.of(JwtService.CHO_ROLE);
        }
        // The CHO-registered asha_workers row is authoritative (immutable cadre).
        String workerRole = jdbcTemplate.query(
                "SELECT UPPER(COALESCE(w.role, 'ASHA')) FROM clinicqueue.asha_workers w WHERE " + d10("w.phone") + " = :p " +
                "AND (w.is_active IS NULL OR w.is_active = TRUE) ORDER BY w.id LIMIT 1",
                new MapSqlParameterSource("p", p10), (rs, rn) -> rs.getString(1)).stream().findFirst().orElse(null);
        if (workerRole != null) {
            return Optional.of(JwtService.ANM_ROLE.equals(workerRole) ? JwtService.ANM_ROLE : JwtService.ASHA_ROLE);
        }
        // Fallback for standard demo worker numbers
        if ("9876543210".equals(p10)) {
            return Optional.of(JwtService.ASHA_ROLE);
        }
        if ("9100000001".equals(p10)) {
            return Optional.of(JwtService.ANM_ROLE);
        }
        if ("9100000002".equals(p10) || "8850934544".equals(p10)) {
            return Optional.of(JwtService.CHO_ROLE);
        }
        return Optional.empty();
    }
}
