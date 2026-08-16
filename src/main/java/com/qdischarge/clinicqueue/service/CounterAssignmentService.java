package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.dto.HospitalDto;
import com.qdischarge.clinicqueue.dto.TokenDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Advanced/multi-counter package: dynamic look-ahead counter assignment.
 * Same "tokens" table and the same base queue (single source of truth,
 * intentionally *not* a forked copy of the schema/service -- see README) --
 * this is what turns on once a hospital's active_counters > 1.
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
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CounterAssignmentService {

    private final NamedParameterJdbcTemplate jdbc;
    private final QueueManagerService queueManagerService;
    private final HospitalService hospitalService;
    private final WhatsAppService whatsAppService;

    private static final RowMapper<TokenDto> TOKEN_ROW_MAPPER = new BeanPropertyRowMapper<>(TokenDto.class);

    public record CounterState(int counterId, TokenDto servingToken) {
    }

    public record CounterBoard(int activeCounters, List<CounterState> counters, List<TokenDto> lookAhead) {
    }

    public CounterBoard getBoard() {
        int activeCounters = activeCounters();
        ensureInitialAssignment(activeCounters);

        List<CounterState> counters = new ArrayList<>();
        for (int c = 1; c <= activeCounters; c++) {
            List<TokenDto> rows = jdbc.query(
                    "SELECT * FROM tokens WHERE status = 'serving' AND counter_id = :c LIMIT 1",
                    Map.of("c", c), TOKEN_ROW_MAPPER);
            counters.add(new CounterState(c, rows.isEmpty() ? null : rows.get(0)));
        }

        int lookAheadSize = 2 * activeCounters;
        List<TokenDto> lookAhead = jdbc.query(
                "SELECT * FROM tokens WHERE status = 'waiting' ORDER BY COALESCE(priority_rank, id) ASC LIMIT :n",
                Map.of("n", lookAheadSize), TOKEN_ROW_MAPPER);

        return new CounterBoard(activeCounters, counters, lookAhead);
    }

    /** Counter finished normally: token -> completed, next eligible waiting token takes the freed counter. */
    public CounterBoard completeAtCounter(int counterId) {
        finishCounter(counterId, "completed");
        claimIntoCounter(counterId);
        return getBoard();
    }

    /** Patient at this counter didn't show (admin gives up waiting): token -> missed, freed counter pulls the next one. */
    public CounterBoard missAtCounter(int counterId) {
        finishCounter(counterId, "missed");
        claimIntoCounter(counterId);
        return getBoard();
    }

    private int activeCounters() {
        HospitalDto hospital = hospitalService.getOperatingHospital();
        return hospital != null ? Math.max(1, hospital.getActiveCounters()) : 1;
    }

    /** First-time setup: nobody assigned to any counter yet -> seed counters 1..N off the front of the queue. */
    private void ensureInitialAssignment(int activeCounters) {
        Integer alreadyAssigned = jdbc.queryForObject(
                "SELECT COUNT(*)::int FROM tokens WHERE status = 'serving' AND counter_id IS NOT NULL",
                Collections.emptyMap(), Integer.class);
        if (alreadyAssigned != null && alreadyAssigned > 0) {
            return;
        }
        for (int c = 1; c <= activeCounters; c++) {
            claimIntoCounter(c);
        }
    }

    private void finishCounter(int counterId, String status) {
        String timeColumn = "completed".equals(status) ? "completed_at" : "missed_at";
        List<TokenDto> rows = jdbc.query(
                "UPDATE tokens SET status = :status, " + timeColumn + " = NOW(), counter_id = NULL "
                        + "WHERE counter_id = :c AND status = 'serving' RETURNING *",
                Map.of("status", status, "c", counterId), TOKEN_ROW_MAPPER);
        if (rows.isEmpty()) {
            return;
        }
        TokenDto token = rows.get(0);
        if ("completed".equals(status)) {
            whatsAppService.sendWhatsAppMessage(token.getPhone(),
                    "✅ Token #" + token.getId() + " has been served. Thank you for visiting! 🙏");
        } else {
            whatsAppService.sendWhatsAppMessage(token.getPhone(),
                    "⚠️ You missed your turn at Counter " + counterId + " for Token #" + token.getId()
                            + ".\n\n📌 Please send \"Hi\" again to generate a new token.");
        }
    }

    private void claimIntoCounter(int counterId) {
        TokenDto claimed = queueManagerService.claimNextEligibleWaitingToken();
        if (claimed == null) {
            return;
        }
        jdbc.update("UPDATE tokens SET counter_id = :c WHERE id = :id", Map.of("c", counterId, "id", claimed.getId()));
        whatsAppService.sendWhatsAppMessage(claimed.getPhone(),
                "🎉 It's your turn! Please proceed to Counter " + counterId + " for Token #" + claimed.getId() + ".");
    }
}
