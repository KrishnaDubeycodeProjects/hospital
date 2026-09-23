package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.bot.BotMessages;
import com.qdischarge.clinicqueue.bot.Lang;
import com.qdischarge.clinicqueue.bot.WaSessionService;
import com.qdischarge.clinicqueue.dto.TokenDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Advanced/multi-counter package: dynamic look-ahead counter assignment.
 * Same "tokens" table and the same base queue (single source of truth,
 * intentionally *not* a forked copy of the schema/service -- see README) --
 * this is what turns on once a (hospital, category) department's
 * active_counters > 1 (see HospitalDepartmentService). Counter numbers are
 * scoped to that department: "Counter 1" of Cardiology and "Counter 1" of
 * Orthopaedics at the same hospital are two different physical counters,
 * every query below is scoped by (hospitalId, category) alongside counterId.
 *
 * Behavior, matching the product spec's worked example for 4 counters:
 * tokens 1-4 are assigned to counters 1-4 to start. When counter 3 (serving
 * token 7, i.e. the batch 5-8) finishes, only counter 3 is refilled with the
 * next queued token (9) -- counters 1, 2, 4 keep serving whatever they
 * already had (5, 6, 8), giving 5, 6, 9, 8. A token that doesn't show up is
 * left alone (admin "waits") until the admin explicitly calls missAtCounter,
 * which frees that counter for the next eligible token exactly like a normal
 * completion would.
 *
 * Look-Ahead Window = 2 x active counters (informational: how many upcoming
 * waiting tokens the admin display board should show as "on deck").
 *
 * Reservations (see refreshReservations): while counters A, B, C are all mid-
 * treatment, a distinct upcoming eligible token is earmarked to each one
 * ("reserved_counter_id") and pinged "you're up next for Counter X" -- purely
 * advisory display/notification, layered on top of the actual claim logic in
 * QueueManagerService, which alone still decides who is genuinely served next
 * once a counter frees up.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CounterAssignmentService {

    private final NamedParameterJdbcTemplate jdbc;
    private final QueueManagerService queueManagerService;
    private final HospitalDepartmentService hospitalDepartmentService;
    private final WhatsAppService whatsAppService;
    private final BotMessages botMessages;
    private final WaSessionService waSessionService;

    private static final RowMapper<TokenDto> TOKEN_ROW_MAPPER = new BeanPropertyRowMapper<>(TokenDto.class);

    public record CounterState(int counterId, TokenDto servingToken) {
    }

    /** One busy counter's earmarked upcoming patient -- see refreshReservations. */
    public record CounterReservation(int counterId, TokenDto token) {
    }

    public record CounterBoard(int activeCounters, List<CounterState> counters, List<TokenDto> lookAhead,
                                List<CounterReservation> upcoming) {
    }

    public CounterBoard getBoard(int hospitalId, String category) {
        int activeCounters = hospitalDepartmentService.activeCounters(hospitalId, category);
        ensureInitialAssignment(hospitalId, category, activeCounters);
        refreshReservations(hospitalId, category, activeCounters);

        List<CounterState> counters = new ArrayList<>();
        for (int c = 1; c <= activeCounters; c++) {
            List<TokenDto> rows = jdbc.query(
                    """
                    SELECT * FROM tokens WHERE status = 'serving' AND counter_id = :c
                      AND hospital_id = :hospitalId AND category = :category LIMIT 1
                    """,
                    Map.of("c", c, "hospitalId", hospitalId, "category", category), TOKEN_ROW_MAPPER);
            counters.add(new CounterState(c, rows.isEmpty() ? null : rows.get(0)));
        }

        int lookAheadSize = 2 * activeCounters;
        List<TokenDto> lookAhead = jdbc.query(
                """
                SELECT * FROM tokens WHERE status = 'waiting' AND hospital_id = :hospitalId AND category = :category
                  AND created_at::date = CURRENT_DATE
                ORDER BY COALESCE(priority_rank, daily_number, 999999) ASC, created_at ASC LIMIT :n
                """,
                Map.of("hospitalId", hospitalId, "category", category, "n", lookAheadSize), TOKEN_ROW_MAPPER);

        List<CounterReservation> upcoming = jdbc.query(
                """
                SELECT * FROM tokens WHERE status = 'waiting' AND reserved_counter_id IS NOT NULL
                  AND hospital_id = :hospitalId AND category = :category
                ORDER BY reserved_counter_id ASC, COALESCE(priority_rank, daily_number, 999999) ASC
                """,
                Map.of("hospitalId", hospitalId, "category", category),
                (rs, rowNum) -> new CounterReservation(rs.getInt("reserved_counter_id"), TOKEN_ROW_MAPPER.mapRow(rs, rowNum)));

        return new CounterBoard(activeCounters, counters, lookAhead, upcoming);
    }

    /** Counter finished normally: token -> completed, directly forwards earmarked/prefixed patient to the freed counter. */
    @org.springframework.transaction.annotation.Transactional(rollbackFor = Exception.class)
    public CounterBoard completeAtCounter(int hospitalId, String category, int counterId) {
        finishCounter(hospitalId, category, counterId, "completed");
        claimIntoCounter(hospitalId, category, counterId);
        return getBoard(hospitalId, category);
    }

    /** Patient at this counter didn't show (admin gives up waiting): token -> missed, freed counter pulls the next one. */
    @org.springframework.transaction.annotation.Transactional(rollbackFor = Exception.class)
    public CounterBoard missAtCounter(int hospitalId, String category, int counterId) {
        finishCounter(hospitalId, category, counterId, "missed");
        claimIntoCounter(hospitalId, category, counterId);
        return getBoard(hospitalId, category);
    }

    /** First-time setup: nobody assigned to any counter yet in this department -> seed counters 1..N off the front of its queue. */
    private void ensureInitialAssignment(int hospitalId, String category, int activeCounters) {
        Integer alreadyAssigned = jdbc.queryForObject(
                """
                SELECT COUNT(*)::int FROM tokens
                WHERE status = 'serving' AND counter_id IS NOT NULL AND hospital_id = :hospitalId AND category = :category
                """,
                Map.of("hospitalId", hospitalId, "category", category), Integer.class);
        if (alreadyAssigned != null && alreadyAssigned > 0) {
            return;
        }
        for (int c = 1; c <= activeCounters; c++) {
            claimIntoCounter(hospitalId, category, c);
        }
    }

    private void finishCounter(int hospitalId, String category, int counterId, String status) {
        String timeColumn = "completed".equals(status) ? "completed_at" : "missed_at";
        Map<String, Object> params = new HashMap<>();
        params.put("status", status);
        params.put("c", counterId);
        params.put("hospitalId", hospitalId);
        params.put("category", category);
        List<TokenDto> rows = jdbc.query(
                "UPDATE tokens SET status = :status, " + timeColumn + " = NOW(), counter_id = NULL "
                        + "WHERE counter_id = :c AND status = 'serving' AND hospital_id = :hospitalId AND category = :category RETURNING *",
                params, TOKEN_ROW_MAPPER);
        if (rows.isEmpty()) {
            return;
        }
        TokenDto token = rows.get(0);
        if ("completed".equals(status)) {
            queueManagerService.archiveToHistory(token);
        }
        log.info("Token {} counter status changed to {}.", token.displayTokenCode(), status);
    }

    private void claimIntoCounter(int hospitalId, String category, int counterId) {
        Map<String, Object> prefParams = new HashMap<>();
        prefParams.put("hospitalId", hospitalId);
        prefParams.put("category", category);
        prefParams.put("counterId", counterId);

        // Check if there is an upcoming waiting patient already prefixed/earmarked for this counter
        List<TokenDto> prefixed = jdbc.query(
                """
                SELECT * FROM tokens
                WHERE status = 'waiting' AND reserved_counter_id = :counterId
                  AND hospital_id IS NOT DISTINCT FROM :hospitalId AND category IS NOT DISTINCT FROM :category
                  AND created_at::date = CURRENT_DATE
                ORDER BY queue_position ASC, priority_rank ASC, daily_number ASC LIMIT 1
                """,
                prefParams, TOKEN_ROW_MAPPER);

        TokenDto claimed = null;
        if (!prefixed.isEmpty()) {
            int prefId = prefixed.get(0).getId();
            List<TokenDto> claimedRows = jdbc.query(
                    "UPDATE tokens SET status = 'serving', served_at = NOW(), counter_id = :c, reserved_counter_id = NULL, queue_position = NULL WHERE id = :id AND status = 'waiting' RETURNING *",
                    Map.of("c", counterId, "id", prefId), TOKEN_ROW_MAPPER);
            if (!claimedRows.isEmpty()) {
                claimed = claimedRows.get(0);
                queueManagerService.renumberQueuePositions(hospitalId, category);
            }
        }

        // If no prefixed patient was found, claim the next eligible waiting token
        if (claimed == null) {
            claimed = queueManagerService.claimNextEligibleWaitingTokenForCounter(hospitalId, category);
            if (claimed != null) {
                jdbc.update("UPDATE tokens SET counter_id = :c, reserved_counter_id = NULL, queue_position = NULL WHERE id = :id",
                        Map.of("c", counterId, "id", claimed.getId()));
                queueManagerService.renumberQueuePositions(hospitalId, category);
            }
        }

        if (claimed != null) {
            log.info("Token {} directly forwarded into Counter {}.", claimed.displayTokenCode(), counterId);
            sendCounterServingNotification(claimed, counterId);
        }

        int activeCounters = hospitalDepartmentService.activeCounters(hospitalId, category);
        refreshReservations(hospitalId, category, activeCounters);
    }

    /**
     * Fixes up to 2 waiting patients prefixed per active counter (e.g. Counter 1: [P1, P2], Counter 2: [P3, P4]).
     * When any counter completes treatment, it directly forwards its prefixed patient.
     */
    private void refreshReservations(int hospitalId, String category, int activeCounters) {
        if (activeCounters <= 0) {
            return;
        }

        int targetPerCounter = 2; // fixed for 2 patients per counter prefixed
        Map<Integer, Integer> reservationCounts = new HashMap<>();
        for (int c = 1; c <= activeCounters; c++) {
            reservationCounts.put(c, 0);
        }

        List<Map<String, Object>> existing = jdbc.queryForList(
                """
                SELECT id, reserved_counter_id, is_verified, notified_ready_at FROM tokens
                WHERE status = 'waiting' AND reserved_counter_id IS NOT NULL
                  AND hospital_id IS NOT DISTINCT FROM :hospitalId AND category IS NOT DISTINCT FROM :category
                  AND created_at::date = CURRENT_DATE
                """,
                Map.of("hospitalId", hospitalId, "category", category));

        for (Map<String, Object> row : existing) {
            boolean verified = Boolean.TRUE.equals(row.get("is_verified"));
            boolean wasNotified = row.get("notified_ready_at") != null;
            if (wasNotified && !verified) {
                jdbc.update("UPDATE tokens SET reserved_counter_id = NULL WHERE id = :id", Map.of("id", row.get("id")));
            } else {
                Integer cid = (Integer) row.get("reserved_counter_id");
                if (cid != null && cid >= 1 && cid <= activeCounters) {
                    reservationCounts.put(cid, reservationCounts.getOrDefault(cid, 0) + 1);
                }
            }
        }

        List<Integer> needsReservation = new ArrayList<>();
        for (int slot = 0; slot < targetPerCounter; slot++) {
            for (int c = 1; c <= activeCounters; c++) {
                if (reservationCounts.getOrDefault(c, 0) < targetPerCounter) {
                    needsReservation.add(c);
                    reservationCounts.put(c, reservationCounts.get(c) + 1);
                }
            }
        }

        if (needsReservation.isEmpty()) {
            return;
        }

        List<Map<String, Object>> candidates = jdbc.queryForList(
                """
                SELECT id, phone, is_verified, notified_ready_at FROM tokens
                WHERE status = 'waiting' AND reserved_counter_id IS NULL
                  AND hospital_id IS NOT DISTINCT FROM :hospitalId AND category IS NOT DISTINCT FROM :category
                  AND created_at::date = CURRENT_DATE
                ORDER BY COALESCE(queue_position, priority_rank, daily_number, 999999) ASC, created_at ASC
                """,
                Map.of("hospitalId", hospitalId, "category", category));

        int nextCounterIdx = 0;
        for (Map<String, Object> candidate : candidates) {
            if (nextCounterIdx >= needsReservation.size()) {
                break;
            }
            boolean verified = Boolean.TRUE.equals(candidate.get("is_verified"));
            boolean wasNotified = candidate.get("notified_ready_at") != null;
            if (wasNotified && !verified) {
                continue;
            }
            int counterId = needsReservation.get(nextCounterIdx++);
            int tokenId = (Integer) candidate.get("id");

            int updated = jdbc.update(
                    "UPDATE tokens SET reserved_counter_id = :c WHERE id = :id AND status = 'waiting' AND reserved_counter_id IS NULL",
                    Map.of("c", counterId, "id", tokenId));
            if (updated == 0) {
                nextCounterIdx--;
                continue;
            }
            log.info("Token id {} prefixed/reserved for Counter {}.", tokenId, counterId);
        }
    }

    private void sendCounterServingNotification(TokenDto token, int counterId) {
        if (token == null || token.getPhone() == null) return;
        try {
            Lang lang = resolveLang(token.getPhone());
            whatsAppService.sendWhatsAppMessage(token.getPhone(),
                    botMessages.nowServingNotification(lang, token.displayTokenCode(), token.getName(), counterId, token.getCategory()));
            log.info("Now serving notification sent for Token {} at Counter {}", token.displayTokenCode(), counterId);
        } catch (Exception e) {
            log.warn("Failed sending now serving notification for Token {}: {}", token.displayTokenCode(), e.getMessage());
        }
    }

    private Lang resolveLang(String phone) {
        try {
            WaSessionService.WaSession session = waSessionService.get(phone);
            if (session != null && session.language() != null) {
                return session.language();
            }
        } catch (Exception ignored) {
        }
        return Lang.EN;
    }
}
