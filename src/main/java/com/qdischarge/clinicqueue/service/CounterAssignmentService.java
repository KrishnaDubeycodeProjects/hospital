package com.qdischarge.clinicqueue.service;

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
                ORDER BY COALESCE(priority_rank, id) ASC LIMIT :n
                """,
                Map.of("hospitalId", hospitalId, "category", category, "n", lookAheadSize), TOKEN_ROW_MAPPER);

        List<CounterReservation> upcoming = jdbc.query(
                """
                SELECT * FROM tokens WHERE status = 'waiting' AND reserved_counter_id IS NOT NULL
                  AND hospital_id = :hospitalId AND category = :category
                ORDER BY reserved_counter_id ASC
                """,
                Map.of("hospitalId", hospitalId, "category", category),
                (rs, rowNum) -> new CounterReservation(rs.getInt("reserved_counter_id"), TOKEN_ROW_MAPPER.mapRow(rs, rowNum)));

        return new CounterBoard(activeCounters, counters, lookAhead, upcoming);
    }

    /** Counter finished normally: token -> completed, next eligible waiting token takes the freed counter. */
    public CounterBoard completeAtCounter(int hospitalId, String category, int counterId) {
        finishCounter(hospitalId, category, counterId, "completed");
        claimIntoCounter(hospitalId, category, counterId);
        return getBoard(hospitalId, category);
    }

    /** Patient at this counter didn't show (admin gives up waiting): token -> missed, freed counter pulls the next one. */
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
        // Proactive WhatsApp notifications from server removed (only respond when user initiates)
        log.info("Token #{} counter status changed to {}. WhatsApp notification skipped.", token.displayNumber(), status);
    }

    private void claimIntoCounter(int hospitalId, String category, int counterId) {
        // The multi-counter variant (unlike single-counter's) reaches past a
        // still-graced front-of-line token instead of blocking every counter
        // on it -- see QueueManagerService#claimNextEligibleWaitingTokenForCounter.
        TokenDto claimed = queueManagerService.claimNextEligibleWaitingTokenForCounter(hospitalId, category);
        if (claimed == null) {
            return;
        }
        // reserved_counter_id = NULL is defensive: a status='waiting' row can
        // carry a reservation, but the instant it's claimed it's no longer
        // 'waiting' anyway, so this just avoids a stale tag lingering on the row.
        jdbc.update("UPDATE tokens SET counter_id = :c, reserved_counter_id = NULL WHERE id = :id",
                Map.of("c", counterId, "id", claimed.getId()));
        log.info("Token #{} claimed into Counter {}. WhatsApp notification skipped.", claimed.displayNumber(), counterId);

        int activeCounters = hospitalDepartmentService.activeCounters(hospitalId, category);
        refreshReservations(hospitalId, category, activeCounters);
    }

    /**
     * Advisory only -- never changes who's actually served next (that's still
     * QueueManagerService#claimNextEligibleWaitingToken's call, at the moment
     * a counter genuinely frees up). While multiple counters are
     * simultaneously mid-treatment, this earmarks a *distinct* upcoming
     * eligible waiting token to each busy counter that doesn't already have
     * one, and pings that patient "you're up next for Counter X" so they can
     * be ready before their counter is even free -- the "next 3 patients set
     * at A, B, C" behavior. A counter that already has a valid reservation is
     * left untouched (no notification churn); an existing reservation is
     * dropped -- and its counter re-filled -- only once its held token is no
     * longer waiting, or fails the same unverified/no-longer-graced
     * eligibility check a real claim would apply. Called after every claim
     * (so a newly-busy counter gets a reservation right away) and on every
     * board read (so a reservation invalidated by e.g. a manual reposition --
     * see QueueManagerService#movePatientToPosition -- gets refilled even
     * without another claim event).
     */
    private void refreshReservations(int hospitalId, String category, int activeCounters) {
        List<Integer> busyCounters = jdbc.query(
                """
                SELECT DISTINCT counter_id FROM tokens WHERE status = 'serving' AND counter_id IS NOT NULL
                  AND counter_id <= :activeCounters AND hospital_id = :hospitalId AND category = :category
                """,
                Map.of("activeCounters", activeCounters, "hospitalId", hospitalId, "category", category),
                (rs, rowNum) -> rs.getInt("counter_id"));
        if (busyCounters.isEmpty()) {
            return; // nobody's actually mid-treatment -- nothing to earmark ahead for
        }

        // Existing reservations: an unverified token whose grace has lapsed
        // (or was never notified/graced at all) would be skipped-and-resolved
        // by a real claim just like at claim time -- drop the reservation so
        // its counter gets re-filled below.
        List<Map<String, Object>> existing = jdbc.queryForList(
                """
                SELECT id, reserved_counter_id, is_verified, notified_ready_at FROM tokens
                WHERE status = 'waiting' AND reserved_counter_id IS NOT NULL
                  AND hospital_id = :hospitalId AND category = :category
                """,
                Map.of("hospitalId", hospitalId, "category", category));

        List<Integer> countersStillValid = new ArrayList<>();
        for (Map<String, Object> row : existing) {
            boolean verified = Boolean.TRUE.equals(row.get("is_verified"));
            boolean wasNotified = row.get("notified_ready_at") != null;
            if (wasNotified && !verified) {
                jdbc.update("UPDATE tokens SET reserved_counter_id = NULL WHERE id = :id", Map.of("id", row.get("id")));
            } else {
                countersStillValid.add((Integer) row.get("reserved_counter_id"));
            }
        }

        List<Integer> needsReservation = new ArrayList<>();
        for (Integer c : busyCounters) {
            if (!countersStillValid.contains(c) && !needsReservation.contains(c)) {
                needsReservation.add(c);
            }
        }
        if (needsReservation.isEmpty()) {
            return;
        }
        Collections.sort(needsReservation);

        List<Map<String, Object>> candidates = jdbc.queryForList(
                """
                SELECT id, phone, is_verified, notified_ready_at FROM tokens
                WHERE status = 'waiting' AND reserved_counter_id IS NULL
                  AND hospital_id = :hospitalId AND category = :category
                ORDER BY COALESCE(priority_rank, id) ASC
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
                continue; // same eligibility skip as a real claim -- not ready to be earmarked yet
            }
            int counterId = needsReservation.get(nextCounterIdx++);
            int tokenId = (Integer) candidate.get("id");
            // Guarded like every other claim/finish update in this class --
            // status='waiting' AND reserved_counter_id IS NULL still true --
            // so a concurrent refreshReservations run (e.g. two admin actions
            // landing close together) can't double-book the same token onto
            // two counters, and we only notify once we know we actually won.
            int updated = jdbc.update(
                    "UPDATE tokens SET reserved_counter_id = :c WHERE id = :id AND status = 'waiting' AND reserved_counter_id IS NULL",
                    Map.of("c", counterId, "id", tokenId));
            if (updated == 0) {
                nextCounterIdx--; // lost the race -- this counter's slot is still open, retry it on the next candidate
                continue;
            }
            // Proactive WhatsApp notifications from server removed (only respond when user initiates)
            log.info("Token reserved for counter {}. WhatsApp notification skipped.", counterId);
        }
    }
}
