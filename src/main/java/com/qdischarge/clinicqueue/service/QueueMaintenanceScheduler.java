package com.qdischarge.clinicqueue.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.Map;

/**
 * Dedicated background maintenance scheduler that decouples queue housekeeping
 * and table hygiene from patient-facing API read paths.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class QueueMaintenanceScheduler {

    private final QueueManagerService queueManagerService;
    private final NamedParameterJdbcTemplate jdbc;

    /**
     * Purges expired queue tokens every 5 minutes instead of forcing writes on GET requests.
     */
    @Scheduled(fixedDelayString = "${app.maintenance.queue-clean-interval-ms:300000}", initialDelay = 60000)
    public void cleanExpiredTokens() {
        try {
            queueManagerService.cleanExpiredTokens();
        } catch (Exception e) {
            log.error("Scheduled expired token cleanup failed: {}", e.getMessage());
        }
    }

    /**
     * Purges expired unverified OTP requests older than 24 hours to prevent table bloat.
     */
    @Scheduled(cron = "0 0 3 * * ?") // Daily at 3:00 AM
    public void purgeStaleOtps() {
        try {
            int deleted = jdbc.update(
                    "DELETE FROM otp_verifications WHERE expires_at < NOW() - INTERVAL '24 hours'",
                    Collections.emptyMap());
            if (deleted > 0) {
                log.info("🧹 Purged {} stale OTP verification records.", deleted);
            }
        } catch (Exception e) {
            log.error("Failed purging stale OTP records: {}", e.getMessage());
        }
    }

    /**
     * Cleans up expired un-claimed doctor access requests older than 48 hours.
     */
    @Scheduled(cron = "0 30 3 * * ?") // Daily at 3:30 AM
    public void purgeExpiredAccessRequests() {
        try {
            int deleted = jdbc.update(
                    "DELETE FROM access_requests WHERE status = 'pending' AND expires_at < NOW() - INTERVAL '48 hours'",
                    Collections.emptyMap());
            if (deleted > 0) {
                log.info("🧹 Purged {} expired unclaimed access requests.", deleted);
            }
        } catch (Exception e) {
            log.error("Failed purging expired access requests: {}", e.getMessage());
        }
    }
}
