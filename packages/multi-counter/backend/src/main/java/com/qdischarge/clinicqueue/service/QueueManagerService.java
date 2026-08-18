package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.CreateTokenResult;
import com.qdischarge.clinicqueue.dto.HospitalDto;
import com.qdischarge.clinicqueue.dto.QueueData;
import com.qdischarge.clinicqueue.dto.SetLocationRequest;
import com.qdischarge.clinicqueue.dto.Stats;
import com.qdischarge.clinicqueue.dto.TokenDto;
import com.qdischarge.clinicqueue.dto.TokenHistoryDto;
import com.qdischarge.clinicqueue.dto.UpdateStatusResult;
import com.qdischarge.clinicqueue.geo.GeoDistanceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Java port of backend/utils/queueManager.js, extended with: hospital-aware,
 * DIGIPIN/distance-based patient locations and dynamic "get ready" notification
 * windows (geo/GeoDistanceService), a dedicated missed-token queue with
 * search + requeue-to-front + reject for reception staff, and priority-rank
 * based ordering so a requeued token can jump to the front of the line
 * without renumbering everyone else.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class QueueManagerService {

    private final NamedParameterJdbcTemplate jdbc;
    private final WhatsAppService whatsAppService;
    private final AppProperties appProperties;
    private final HospitalService hospitalService;
    private final GeoDistanceService geoDistanceService;
    private final OtpService otpService;

    private static final RowMapper<TokenDto> TOKEN_ROW_MAPPER = new BeanPropertyRowMapper<>(TokenDto.class);
    private static final RowMapper<TokenHistoryDto> TOKEN_HISTORY_ROW_MAPPER = new BeanPropertyRowMapper<>(TokenHistoryDto.class);
    /** Ordering expression: a requeued-to-front token's negative priority_rank sorts before every plain id. */
    private static final String QUEUE_ORDER = "COALESCE(priority_rank, id) ASC";

    // -----------------------------------------------------------------
    // Expired-token cleanup (runs before every read, same as the original)
    // -----------------------------------------------------------------
    private void cleanExpiredTokens() {
        String sql = """
                UPDATE tokens
                SET status = 'missed', missed_at = NOW()
                WHERE status IN ('waiting', 'serving', 'registering_name')
                  AND created_at < NOW() - (:hours || ' hours')::INTERVAL
                """;
        try {
            jdbc.update(sql, Map.of("hours", String.valueOf(appProperties.getTokenExpiryHours())));
        } catch (Exception e) {
            log.error("Error cleaning expired tokens: {}", e.getMessage());
        }
    }

    public QueueData getQueue() {
        cleanExpiredTokens();
        fireDueReadyNotifications();

        List<TokenDto> tokens = jdbc.query(
                "SELECT * FROM tokens WHERE status != 'registering_name' ORDER BY " + QUEUE_ORDER,
                Collections.emptyMap(), TOKEN_ROW_MAPPER);

        int total = tokens.size();
        long waiting = tokens.stream().filter(t -> "waiting".equals(t.getStatus())).count();
        long serving = tokens.stream().filter(t -> "serving".equals(t.getStatus())).count();
        long completed = tokens.stream().filter(t -> "completed".equals(t.getStatus())).count();
        long missed = tokens.stream().filter(t -> "missed".equals(t.getStatus())).count();

        Integer currentServing = tokens.stream()
                .filter(t -> "serving".equals(t.getStatus()))
                .map(TokenDto::getId)
                .findFirst()
                .orElse(null);

        Stats stats = new Stats(total, (int) waiting, (int) serving, (int) completed, (int) missed);
        return new QueueData(tokens, currentServing, stats);
    }

    public TokenDto getCurrentServingToken() {
        cleanExpiredTokens();

        List<TokenDto> rows = jdbc.query(
                "SELECT * FROM tokens WHERE status = 'serving' ORDER BY served_at DESC LIMIT 1",
                Collections.emptyMap(), TOKEN_ROW_MAPPER);
        if (rows.isEmpty()) {
            return null;
        }
        TokenDto t = rows.get(0);
        return TokenDto.builder()
                .id(t.getId()).name(t.getName()).phone(t.getPhone()).status(t.getStatus())
                .sessionStep(t.getSessionStep()).createdAt(t.getCreatedAt()).servedAt(t.getServedAt())
                .counterId(t.getCounterId())
                .build();
    }

    public TokenDto getPatientPosition(String phone) {
        cleanExpiredTokens();
        fireDueReadyNotifications();

        String sql = """
                SELECT * FROM tokens
                WHERE (phone = :phone OR phone = '+' || :phone OR phone = REPLACE(:phone, '+', '') OR phone LIKE '%' || :phone)
                  AND status IN ('waiting', 'serving')
                LIMIT 1
                """;
        List<TokenDto> rows = jdbc.query(sql, Map.of("phone", phone), TOKEN_ROW_MAPPER);
        if (rows.isEmpty()) {
            return null;
        }
        TokenDto token = rows.get(0);
        QueueData queueData = getQueue();

        if ("serving".equals(token.getStatus())) {
            return withGeoFields(TokenDto.builder()
                    .id(token.getId()).name(token.getName()).phone(token.getPhone()).status(token.getStatus())
                    .sessionStep(token.getSessionStep()).position(0).peopleAhead(0)
                    .currentServing(queueData.currentServing())
                    .isVerified(token.getIsVerified()).verifiedAt(token.getVerifiedAt())
                    .build(), token);
        }

        int peopleAhead = countWaitingAhead(token);

        return withGeoFields(TokenDto.builder()
                .id(token.getId()).name(token.getName()).phone(token.getPhone()).status(token.getStatus())
                .sessionStep(token.getSessionStep()).position(peopleAhead + 1).peopleAhead(peopleAhead)
                .currentServing(queueData.currentServing())
                .isVerified(token.getIsVerified()).verifiedAt(token.getVerifiedAt())
                .build(), token);
    }

    public TokenDto getTokenDetails(String idStr) {
        cleanExpiredTokens();
        fireDueReadyNotifications();

        int id = Integer.parseInt(idStr);
        List<TokenDto> rows = jdbc.query(
                "SELECT * FROM tokens WHERE id = :id LIMIT 1", Map.of("id", id), TOKEN_ROW_MAPPER);
        if (rows.isEmpty()) {
            return null;
        }
        TokenDto token = rows.get(0);
        QueueData queueData = getQueue();

        if (!"waiting".equals(token.getStatus())) {
            return withGeoFields(TokenDto.builder()
                    .id(token.getId()).name(token.getName()).phone(token.getPhone()).status(token.getStatus())
                    .sessionStep(token.getSessionStep()).position(0).peopleAhead(0)
                    .currentServing(queueData.currentServing())
                    .isVerified(token.getIsVerified()).verifiedAt(token.getVerifiedAt())
                    .missedAt(token.getMissedAt()).rejectedAt(token.getRejectedAt())
                    .build(), token);
        }

        int peopleAhead = countWaitingAhead(token);

        return withGeoFields(TokenDto.builder()
                .id(token.getId()).name(token.getName()).phone(token.getPhone()).status(token.getStatus())
                .sessionStep(token.getSessionStep()).position(peopleAhead + 1).peopleAhead(peopleAhead)
                .currentServing(queueData.currentServing())
                .isVerified(token.getIsVerified()).verifiedAt(token.getVerifiedAt())
                .build(), token);
    }

    /** Copies the geo/priority fields from a freshly-read raw row onto a purpose-built response DTO. */
    private TokenDto withGeoFields(TokenDto target, TokenDto raw) {
        target.setHospitalId(raw.getHospitalId());
        target.setPatientDigipin(raw.getPatientDigipin());
        target.setDistanceKm(raw.getDistanceKm());
        target.setNotifyTokensAhead(raw.getNotifyTokensAhead());
        target.setPriorityWindow(raw.getPriorityWindow());
        target.setNotifiedReadyAt(raw.getNotifiedReadyAt());
        target.setPriorityRank(raw.getPriorityRank());
        target.setCounterId(raw.getCounterId());
        return target;
    }

    private int countWaitingAhead(TokenDto token) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*)::int FROM tokens WHERE status = 'waiting' AND COALESCE(priority_rank, id) < :sortKey",
                Map.of("sortKey", token.getPriorityRank() != null ? token.getPriorityRank() : token.getId()),
                Integer.class);
        return count == null ? 0 : count;
    }

    public TokenDto getActiveToken(String phone) {
        cleanExpiredTokens();

        String sql = """
                SELECT * FROM tokens
                WHERE (phone = :phone OR phone = '+' || :phone OR phone = REPLACE(:phone, '+', '') OR phone LIKE '%' || :phone)
                  AND status IN ('waiting', 'serving', 'registering_name')
                LIMIT 1
                """;
        List<TokenDto> rows = jdbc.query(sql, Map.of("phone", phone), TOKEN_ROW_MAPPER);
        if (rows.isEmpty()) {
            return null;
        }
        TokenDto t = rows.get(0);
        return TokenDto.builder()
                .id(t.getId()).name(t.getName()).phone(t.getPhone()).status(t.getStatus())
                .sessionStep(t.getSessionStep()).createdAt(t.getCreatedAt())
                .build();
    }

    public TokenDto createRegisteringToken(String phone) {
        TokenDto active = getActiveToken(phone);
        if (active != null) {
            return active;
        }
        String sql = """
                INSERT INTO tokens (name, phone, status, session_step)
                VALUES ('Patient', :phone, 'registering_name', 'awaiting_name')
                RETURNING *
                """;
        List<TokenDto> rows = jdbc.query(sql, Map.of("phone", phone), TOKEN_ROW_MAPPER);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** STEP 1 of registration: name captured, still not queued -- next asks for age (see captureAge). */
    public TokenDto captureName(int tokenId, String name) {
        String sql = "UPDATE tokens SET name = :name, session_step = 'awaiting_age' WHERE id = :id RETURNING *";
        List<TokenDto> rows = jdbc.query(sql, Map.of("name", name, "id", tokenId), TOKEN_ROW_MAPPER);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** STEP 2 of registration: age captured, token is now actually queued. */
    public TokenDto captureAge(int tokenId, int age) {
        String sql = """
                UPDATE tokens
                SET age = :age, status = 'waiting', session_step = 'menu', created_at = NOW()
                WHERE id = :id
                RETURNING *
                """;
        List<TokenDto> rows = jdbc.query(sql, Map.of("age", age, "id", tokenId), TOKEN_ROW_MAPPER);
        if (rows.isEmpty()) {
            return null;
        }
        return getTokenDetails(String.valueOf(tokenId));
    }

    public CreateTokenResult createToken(String name, String phone) {
        return createToken(name, null, phone, null);
    }

    /** age and location are both optional -- when location is given (current GPS or manually entered), the distance-based notify window is computed immediately. */
    public CreateTokenResult createToken(String name, Integer age, String phone, SetLocationRequest location) {
        cleanExpiredTokens();

        if (appProperties.isOtpRequiredForRegistration() && !otpService.isPhoneVerifiedRecently(phone)) {
            throw new IllegalStateException("Please verify your phone number with the OTP sent via SMS before registering.");
        }

        TokenDto active = getActiveToken(phone);
        if (active != null) {
            return new CreateTokenResult(true, getTokenDetails(String.valueOf(active.getId())));
        }

        HospitalDto hospital = hospitalService.getOperatingHospital();
        String defaultName = (name == null || name.isBlank()) ? "Patient" : name;

        Map<String, Object> insertParams = new HashMap<>();
        insertParams.put("name", defaultName);
        insertParams.put("age", age);
        insertParams.put("phone", phone);
        insertParams.put("hospitalId", hospital != null ? hospital.getId() : null);

        Integer newId = jdbc.queryForObject(
                "INSERT INTO tokens (name, age, phone, status, session_step, hospital_id) VALUES (:name, :age, :phone, 'waiting', 'menu', :hospitalId) RETURNING id",
                insertParams, Integer.class);

        if (location != null && hospital != null) {
            try {
                applyPatientLocation(newId, location, hospital);
            } catch (Exception e) {
                log.error("Could not apply patient location for token {}: {}", newId, e.getMessage());
            }
        }

        return new CreateTokenResult(false, getTokenDetails(String.valueOf(newId)));
    }

    /** Sets/updates a patient's location on an existing token and recomputes distance + notify window from it. */
    public TokenDto updateTokenLocation(int tokenId, SetLocationRequest location) {
        List<TokenDto> rows = jdbc.query("SELECT * FROM tokens WHERE id = :id", Map.of("id", tokenId), TOKEN_ROW_MAPPER);
        if (rows.isEmpty()) {
            return null;
        }
        TokenDto token = rows.get(0);
        HospitalDto hospital = token.getHospitalId() != null
                ? hospitalService.getById(token.getHospitalId())
                : hospitalService.getOperatingHospital();
        if (hospital == null) {
            throw new IllegalStateException("Hospital location is not configured yet.");
        }
        applyPatientLocation(tokenId, location, hospital);
        return getTokenDetails(String.valueOf(tokenId));
    }

    private void applyPatientLocation(int tokenId, SetLocationRequest location, HospitalDto hospital) {
        HospitalService.LatLon resolved = hospitalService.resolveLocation(location);
        double distanceKm = geoDistanceService.distanceKm(
                hospital.getLatitude(), hospital.getLongitude(), resolved.lat(), resolved.lon());
        double travelMinutes = geoDistanceService.estimatedTravelMinutes(distanceKm);
        int notifyTokensAhead = geoDistanceService.notifyTokensAhead(travelMinutes);
        int priorityWindow = geoDistanceService.priorityWindow(notifyTokensAhead, hospital.getActiveCounters());

        jdbc.update(
                """
                UPDATE tokens
                SET patient_digipin = :digipin, patient_lat = :lat, patient_lon = :lon,
                    distance_km = :distanceKm, notify_tokens_ahead = :notifyTokensAhead,
                    priority_window = :priorityWindow, notified_ready_at = NULL
                WHERE id = :id
                """,
                Map.of("digipin", resolved.digipin(), "lat", resolved.lat(), "lon", resolved.lon(),
                        "distanceKm", distanceKm, "notifyTokensAhead", notifyTokensAhead,
                        "priorityWindow", priorityWindow, "id", tokenId));
    }

    /**
     * Can this patient realistically reach the hospital before OPD closes,
     * given their current distance? Pure read -- callers decide what to do
     * with a "no" (e.g. show "Continue anyway / Choose another hospital").
     */
    public GeoDistanceService.ArrivalFeasibility checkClosingTimeFeasibility(double lat, double lon) {
        HospitalDto hospital = hospitalService.getOperatingHospital();
        if (hospital == null) {
            throw new IllegalStateException("Hospital location is not configured yet.");
        }
        double distanceKm = geoDistanceService.distanceKm(hospital.getLatitude(), hospital.getLongitude(), lat, lon);
        double travelMinutes = geoDistanceService.estimatedTravelMinutes(distanceKm);

        java.time.LocalTime now = java.time.LocalTime.now();
        long minutesUntilClose = java.time.Duration.between(now, hospital.getCloseTime()).toMinutes();
        return geoDistanceService.checkClosingTime(distanceKm, travelMinutes, minutesUntilClose);
    }

    /**
     * Opportunistic scan (run on every queue/position read, same pattern as
     * cleanExpiredTokens): for every waiting token close enough to the front
     * that it's within its distance-based notify window and hasn't been
     * pinged yet, send the "get ready, come to the hospital" WhatsApp message.
     */
    private void fireDueReadyNotifications() {
        try {
            List<Map<String, Object>> candidates = jdbc.queryForList(
                    """
                    SELECT id, phone, notify_tokens_ahead, distance_km FROM tokens
                    WHERE status = 'waiting' AND notify_tokens_ahead IS NOT NULL AND notified_ready_at IS NULL
                    """, Collections.emptyMap());

            for (Map<String, Object> row : candidates) {
                int id = (Integer) row.get("id");
                String phone = (String) row.get("phone");
                int notifyTokensAhead = (Integer) row.get("notify_tokens_ahead");
                Double distanceKm = (Double) row.get("distance_km");

                int peopleAhead = jdbc.queryForObject(
                        "SELECT COUNT(*)::int FROM tokens WHERE status = 'waiting' AND COALESCE(priority_rank, id) < COALESCE((SELECT priority_rank FROM tokens WHERE id = :id), :id)",
                        Map.of("id", id), Integer.class);

                if (peopleAhead <= notifyTokensAhead) {
                    int updated = jdbc.update(
                            "UPDATE tokens SET notified_ready_at = NOW() WHERE id = :id AND notified_ready_at IS NULL",
                            Map.of("id", id));
                    if (updated > 0) {
                        String distanceText = distanceKm != null ? " (you're ~%.1f km away)".formatted(distanceKm) : "";
                        whatsAppService.sendWhatsAppMessage(phone,
                                "🚗 Get ready! There are about " + peopleAhead + " people ahead of you" + distanceText
                                        + ". Please start heading to the hospital now so you don't miss your turn.");
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error firing ready notifications: {}", e.getMessage());
        }
    }

    private void sendTurnNotification(String phone, int tokenId) {
        whatsAppService.sendWhatsAppMessage(phone,
                "🎉 It's your turn now! Please come to the counter for Token #" + tokenId + ".");
    }

    private void sendNextInLineNotification(String phone, int tokenId) {
        whatsAppService.sendWhatsAppMessage(phone,
                "🔔 You are next in line for Token #" + tokenId + "! There is only 1 person ahead of you. Please be ready.");
    }

    public UpdateStatusResult updateTokenStatus(String idStr, String status) {
        int tokenId = Integer.parseInt(idStr);

        if ("serving".equals(status)) {
            jdbc.update("UPDATE tokens SET status = 'completed', completed_at = NOW() WHERE status = 'serving' AND id != :id",
                    Map.of("id", tokenId));

            List<TokenDto> rows = jdbc.query(
                    "UPDATE tokens SET status = 'serving', served_at = NOW() WHERE id = :id RETURNING *",
                    Map.of("id", tokenId), TOKEN_ROW_MAPPER);
            if (rows.isEmpty()) {
                return null;
            }
            TokenDto token = rows.get(0);
            sendTurnNotification(token.getPhone(), token.getId());

            TokenDto view = TokenDto.builder()
                    .id(token.getId()).phone(token.getPhone()).name(token.getName()).status(token.getStatus())
                    .sessionStep(token.getSessionStep()).createdAt(token.getCreatedAt()).servedAt(token.getServedAt())
                    .build();
            return new UpdateStatusResult(view, null);
        }

        if ("completed".equals(status) || "missed".equals(status)) {
            String timeColumn = "completed".equals(status) ? "completed_at" : "missed_at";
            String updateSql = "UPDATE tokens SET status = :status, " + timeColumn + " = NOW() WHERE id = :id RETURNING *";
            List<TokenDto> rows = jdbc.query(updateSql, Map.of("status", status, "id", tokenId), TOKEN_ROW_MAPPER);
            if (rows.isEmpty()) {
                return null;
            }
            TokenDto updatedToken = rows.get(0);

            if ("completed".equals(status)) {
                archiveToHistory(updatedToken);
                whatsAppService.sendWhatsAppMessage(updatedToken.getPhone(),
                        "✅ Token #" + updatedToken.getId() + " has been served. Thank you for visiting "
                                + appProperties.getClinicName() + "! 🙏");
            } else {
                whatsAppService.sendWhatsAppMessage(updatedToken.getPhone(),
                        "⚠️ You missed your turn for Token #" + updatedToken.getId()
                                + ".\n\n📌 Please send \"Hi\" or \"Hello\" again to generate a new token.");
            }

            Integer nextServingId = advanceToNextEligibleWaiting();

            TokenDto view = TokenDto.builder()
                    .id(updatedToken.getId()).phone(updatedToken.getPhone()).name(updatedToken.getName())
                    .status(updatedToken.getStatus()).sessionStep(updatedToken.getSessionStep())
                    .createdAt(updatedToken.getCreatedAt()).servedAt(updatedToken.getServedAt())
                    .completedAt(updatedToken.getCompletedAt()).missedAt(updatedToken.getMissedAt())
                    .build();
            return new UpdateStatusResult(view, nextServingId);
        }

        // Fallback branch: only remaining valid status is 'waiting' (route validation
        // restricts status to waiting/serving/completed/missed).
        List<TokenDto> rows = jdbc.query(
                "UPDATE tokens SET status = :status, served_at = NULL, completed_at = NULL, missed_at = NULL WHERE id = :id RETURNING *",
                Map.of("status", status, "id", tokenId), TOKEN_ROW_MAPPER);
        if (rows.isEmpty()) {
            return null;
        }
        TokenDto token = rows.get(0);
        TokenDto view = TokenDto.builder()
                .id(token.getId()).phone(token.getPhone()).name(token.getName()).status(token.getStatus())
                .sessionStep(token.getSessionStep()).createdAt(token.getCreatedAt())
                .build();
        return new UpdateStatusResult(view, null);
    }

    /**
     * Copies a just-completed token into the permanent token_history ledger.
     * Doesn't touch/delete the "tokens" row -- today's live stats/queue view
     * (getQueue()) still count it exactly as before; this just also gives it
     * a durable, per-phone-searchable home (see getPatientHistory) that
     * outlives it. The same phone number was already free to book a new
     * token -- for a different patient, different name/age -- the instant
     * this one left 'waiting'/'serving'/'registering_name'; this is purely
     * the audit trail for that.
     */
    private void archiveToHistory(TokenDto token) {
        // Map.of() rejects null values outright, and age/hospitalId/counterId/servedAt
        // can legitimately be null -- a plain HashMap tolerates them.
        Map<String, Object> params = new HashMap<>();
        params.put("tokenId", token.getId());
        params.put("phone", token.getPhone());
        params.put("name", token.getName());
        params.put("age", token.getAge());
        params.put("hospitalId", token.getHospitalId());
        params.put("counterId", token.getCounterId());
        params.put("createdAt", token.getCreatedAt());
        params.put("servedAt", token.getServedAt());
        params.put("completedAt", token.getCompletedAt() != null ? token.getCompletedAt() : java.time.LocalDateTime.now());

        jdbc.update(
                """
                INSERT INTO token_history (token_id, phone, name, age, hospital_id, counter_id, created_at, served_at, completed_at)
                VALUES (:tokenId, :phone, :name, :age, :hospitalId, :counterId, :createdAt, :servedAt, :completedAt)
                """,
                params);
    }

    /** Every past completed visit under this phone number, most recent first -- across however many different patients have used it. */
    public List<TokenHistoryDto> getPatientHistory(String phone) {
        return jdbc.query(
                "SELECT * FROM token_history WHERE phone = :phone ORDER BY completed_at DESC NULLS LAST, id DESC",
                Map.of("phone", phone), TOKEN_HISTORY_ROW_MAPPER);
    }

    /**
     * Picks the next waiting token to serve, in queue order, auto-skipping
     * (marking 'missed', no manual intervention needed) any token that was
     * already sent its distance-based "get ready" ping but never checked in
     * (barcode-scanned / is_verified) by the time its turn came up -- the
     * "Missed Priority Window" rule. Also pings the following token as
     * "next in line" once a token is actually put into service.
     */
    private Integer advanceToNextEligibleWaiting() {
        TokenDto claimed = claimNextEligibleWaitingToken();
        if (claimed == null) {
            return null;
        }
        sendTurnNotification(claimed.getPhone(), claimed.getId());

        List<Map<String, Object>> upNext = jdbc.queryForList(
                "SELECT id, phone FROM tokens WHERE status = 'waiting' ORDER BY " + QUEUE_ORDER + " LIMIT 1",
                Collections.emptyMap());
        if (!upNext.isEmpty()) {
            sendNextInLineNotification((String) upNext.get(0).get("phone"), (Integer) upNext.get(0).get("id"));
        }
        return claimed.getId();
    }

    /**
     * Atomically claims the front-most waiting token and flips it to 'serving',
     * auto-skipping (marking 'missed', no manual intervention needed) any token
     * ahead of it whose distance-based priority window already closed without a
     * check-in. Shared by the single-counter flow above and by
     * CounterAssignmentService for the multi-counter package -- neither sends
     * the "your turn" notification here, since the multi-counter caller needs
     * to mention which counter to go to.
     */
    public TokenDto claimNextEligibleWaitingToken() {
        int guard = 0;
        while (guard++ < 200) {
            List<Map<String, Object>> candidates = jdbc.queryForList(
                    "SELECT id, phone, is_verified, notified_ready_at FROM tokens WHERE status = 'waiting' ORDER BY "
                            + QUEUE_ORDER + " LIMIT 1",
                    Collections.emptyMap());
            if (candidates.isEmpty()) {
                return null;
            }
            Map<String, Object> candidate = candidates.get(0);
            int id = (Integer) candidate.get("id");
            String phone = (String) candidate.get("phone");
            boolean verified = Boolean.TRUE.equals(candidate.get("is_verified"));
            boolean wasNotified = candidate.get("notified_ready_at") != null;

            if (wasNotified && !verified) {
                jdbc.update("UPDATE tokens SET status = 'missed', missed_at = NOW() WHERE id = :id AND status = 'waiting'",
                        Map.of("id", id));
                whatsAppService.sendWhatsAppMessage(phone,
                        "⚠️ Your priority window closed before you checked in for Token #" + id
                                + ", so it's been marked missed.\n\n📌 Ask reception to reinstate it, or send \"Hi\" for a new token.");
                continue; // try the next one in line
            }

            List<TokenDto> claimedRows = jdbc.query(
                    "UPDATE tokens SET status = 'serving', served_at = NOW() WHERE id = :id AND status = 'waiting' RETURNING *",
                    Map.of("id", id), TOKEN_ROW_MAPPER);
            if (claimedRows.isEmpty()) {
                continue; // lost a race (e.g. concurrent admin action) -- retry
            }
            return claimedRows.get(0);
        }
        log.error("claimNextEligibleWaitingToken() hit its safety guard without resolving -- check for a stuck loop.");
        return null;
    }

    public TokenDto verifyTokenByAdmin(int id) {
        List<TokenDto> rows = jdbc.query(
                "UPDATE tokens SET is_verified = TRUE, verified_at = NOW() WHERE id = :id RETURNING *",
                Map.of("id", id), TOKEN_ROW_MAPPER);
        if (rows.isEmpty()) {
            return null;
        }
        TokenDto token = rows.get(0);
        TokenDto details = getTokenDetails(String.valueOf(token.getId()));

        Integer pos = details != null ? details.getPosition() : null;
        String positionText = (pos != null && pos != 0) ? (pos == 1 ? "1st" : pos + "th") : "In Queue";

        String welcomeMsg = """
                🏥 *WELCOME TO THE HOSPITAL!*

                Hello *%s*,

                Your queue Token *#%d* has been scanned and *VERIFIED* by our reception desk! ✅

                📍 *Status:* Checked-In & Verified
                👥 *Queue Position:* %s

                Thank you for visiting %s. Please take a seat in our waiting room. We will notify you on WhatsApp as soon as your turn arrives! 🙏"""
                .formatted(token.getName(), token.getId(), positionText, appProperties.getClinicName());

        whatsAppService.sendWhatsAppMessage(token.getPhone(), welcomeMsg);

        return details;
    }

    // -----------------------------------------------------------------
    // Missed queue: admin search, requeue-to-front, reject
    // -----------------------------------------------------------------

    /** Ordered oldest-missed-first, newest-missed-last (a patient who missed later sits at the bottom). */
    public List<TokenDto> getMissedQueue() {
        cleanExpiredTokens();
        return jdbc.query(
                "SELECT * FROM tokens WHERE status = 'missed' ORDER BY missed_at ASC NULLS LAST, id ASC",
                Collections.emptyMap(), TOKEN_ROW_MAPPER);
    }

    /** Search the missed queue by token id (exact) or phone number (partial match). */
    public List<TokenDto> searchMissedQueue(String query) {
        cleanExpiredTokens();
        String q = query == null ? "" : query.trim();
        if (q.isEmpty()) {
            return getMissedQueue();
        }

        Map<String, Object> params = new HashMap<>();
        params.put("phoneLike", "%" + q + "%");

        String sql;
        if (q.matches("\\d+")) {
            params.put("idExact", Integer.parseInt(q));
            sql = """
                    SELECT * FROM tokens WHERE status = 'missed' AND (id = :idExact OR phone LIKE :phoneLike)
                    ORDER BY missed_at ASC NULLS LAST, id ASC
                    """;
        } else {
            sql = """
                    SELECT * FROM tokens WHERE status = 'missed' AND phone LIKE :phoneLike
                    ORDER BY missed_at ASC NULLS LAST, id ASC
                    """;
        }
        return jdbc.query(sql, params, TOKEN_ROW_MAPPER);
    }

    /** Puts a missed token back into the waiting queue at the very front (position #1), ahead of everyone else waiting. */
    public TokenDto requeueMissedToFront(int id) {
        Long minRank = jdbc.queryForObject(
                "SELECT COALESCE(MIN(priority_rank), 0) FROM tokens WHERE status = 'waiting'", Collections.emptyMap(), Long.class);
        long newRank = Math.min(minRank == null ? 0L : minRank, 0L) - 1;

        List<TokenDto> rows = jdbc.query(
                """
                UPDATE tokens
                SET status = 'waiting', priority_rank = :rank,
                    missed_at = NULL, served_at = NULL, completed_at = NULL, rejected_at = NULL,
                    notified_ready_at = NULL
                WHERE id = :id AND status = 'missed'
                RETURNING *
                """, Map.of("id", id, "rank", newRank), TOKEN_ROW_MAPPER);

        if (rows.isEmpty()) {
            return null;
        }
        TokenDto token = rows.get(0);
        whatsAppService.sendWhatsAppMessage(token.getPhone(),
                "✅ Good news! Reception has reinstated your Token #" + token.getId()
                        + " and moved it to the FRONT of the queue. Please come to the counter now.");
        return getTokenDetails(String.valueOf(id));
    }

    /** Closes out a missed token permanently -- it will not be auto-cleaned or reappear anywhere active. */
    public TokenDto rejectMissedToken(int id) {
        List<TokenDto> rows = jdbc.query(
                "UPDATE tokens SET status = 'rejected', rejected_at = NOW() WHERE id = :id AND status = 'missed' RETURNING *",
                Map.of("id", id), TOKEN_ROW_MAPPER);
        if (rows.isEmpty()) {
            return null;
        }
        TokenDto token = rows.get(0);
        whatsAppService.sendWhatsAppMessage(token.getPhone(),
                "❌ Your missed Token #" + token.getId() + " has been closed by reception. "
                        + "Please send \"Hi\" to generate a new token if you'd still like to visit.");
        return token;
    }
}
