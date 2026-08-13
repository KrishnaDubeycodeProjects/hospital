package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.CreateTokenResult;
import com.qdischarge.clinicqueue.dto.QueueData;
import com.qdischarge.clinicqueue.dto.Stats;
import com.qdischarge.clinicqueue.dto.TokenDto;
import com.qdischarge.clinicqueue.dto.UpdateStatusResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Java port of backend/utils/queueManager.js. Talks to Postgres directly via
 * NamedParameterJdbcTemplate (the same raw-SQL style the original used through
 * node-postgres), and triggers the same WhatsApp notifications on state changes.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class QueueManagerService {

    private final NamedParameterJdbcTemplate jdbc;
    private final WhatsAppService whatsAppService;
    private final AppProperties appProperties;

    private static final RowMapper<TokenDto> TOKEN_ROW_MAPPER = new BeanPropertyRowMapper<>(TokenDto.class);

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

        List<TokenDto> tokens = jdbc.query(
                "SELECT * FROM tokens WHERE status != 'registering_name' ORDER BY id ASC",
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
                .build();
    }

    public TokenDto getPatientPosition(String phone) {
        cleanExpiredTokens();

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
            return TokenDto.builder()
                    .id(token.getId()).name(token.getName()).phone(token.getPhone()).status(token.getStatus())
                    .sessionStep(token.getSessionStep()).position(0).peopleAhead(0)
                    .currentServing(queueData.currentServing())
                    .isVerified(token.getIsVerified()).verifiedAt(token.getVerifiedAt())
                    .build();
        }

        int peopleAhead = countWaitingAhead(token.getId());

        return TokenDto.builder()
                .id(token.getId()).name(token.getName()).phone(token.getPhone()).status(token.getStatus())
                .sessionStep(token.getSessionStep()).position(peopleAhead + 1).peopleAhead(peopleAhead)
                .currentServing(queueData.currentServing())
                .isVerified(token.getIsVerified()).verifiedAt(token.getVerifiedAt())
                .build();
    }

    public TokenDto getTokenDetails(String idStr) {
        cleanExpiredTokens();

        int id = Integer.parseInt(idStr);
        List<TokenDto> rows = jdbc.query(
                "SELECT * FROM tokens WHERE id = :id LIMIT 1", Map.of("id", id), TOKEN_ROW_MAPPER);
        if (rows.isEmpty()) {
            return null;
        }
        TokenDto token = rows.get(0);
        QueueData queueData = getQueue();

        if (!"waiting".equals(token.getStatus())) {
            return TokenDto.builder()
                    .id(token.getId()).name(token.getName()).phone(token.getPhone()).status(token.getStatus())
                    .sessionStep(token.getSessionStep()).position(0).peopleAhead(0)
                    .currentServing(queueData.currentServing())
                    .isVerified(token.getIsVerified()).verifiedAt(token.getVerifiedAt())
                    .build();
        }

        int peopleAhead = countWaitingAhead(token.getId());

        return TokenDto.builder()
                .id(token.getId()).name(token.getName()).phone(token.getPhone()).status(token.getStatus())
                .sessionStep(token.getSessionStep()).position(peopleAhead + 1).peopleAhead(peopleAhead)
                .currentServing(queueData.currentServing())
                .isVerified(token.getIsVerified()).verifiedAt(token.getVerifiedAt())
                .build();
    }

    private int countWaitingAhead(int tokenId) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*)::int FROM tokens WHERE status = 'waiting' AND id < :id",
                Map.of("id", tokenId), Integer.class);
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

    public TokenDto completeRegistration(int tokenId, String name) {
        String sql = """
                UPDATE tokens
                SET name = :name, status = 'waiting', session_step = 'menu', created_at = NOW()
                WHERE id = :id
                RETURNING *
                """;
        List<TokenDto> rows = jdbc.query(sql, Map.of("name", name, "id", tokenId), TOKEN_ROW_MAPPER);
        if (rows.isEmpty()) {
            return null;
        }
        return getTokenDetails(String.valueOf(tokenId));
    }

    public CreateTokenResult createToken(String name, String phone) {
        cleanExpiredTokens();

        TokenDto active = getActiveToken(phone);
        if (active != null) {
            return new CreateTokenResult(true, getTokenDetails(String.valueOf(active.getId())));
        }

        String defaultName = (name == null || name.isBlank()) ? "Patient" : name;
        Integer newId = jdbc.queryForObject(
                "INSERT INTO tokens (name, phone, status, session_step) VALUES (:name, :phone, 'waiting', 'menu') RETURNING id",
                Map.of("name", defaultName, "phone", phone), Integer.class);

        return new CreateTokenResult(false, getTokenDetails(String.valueOf(newId)));
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
                whatsAppService.sendWhatsAppMessage(updatedToken.getPhone(),
                        "✅ Token #" + updatedToken.getId() + " has been served. Thank you for visiting "
                                + appProperties.getClinicName() + "! 🙏");
            } else {
                whatsAppService.sendWhatsAppMessage(updatedToken.getPhone(),
                        "⚠️ You missed your turn for Token #" + updatedToken.getId()
                                + ".\n\n📌 Please send \"Hi\" or \"Hello\" again to generate a new token.");
            }

            List<Map<String, Object>> nextWaiting = jdbc.queryForList(
                    "SELECT id, phone FROM tokens WHERE status = 'waiting' ORDER BY id ASC LIMIT 2",
                    Collections.emptyMap());
            Integer nextServingId = null;

            if (!nextWaiting.isEmpty()) {
                Map<String, Object> nextServe = nextWaiting.get(0);
                Integer nextServeId = (Integer) nextServe.get("id");
                String nextServePhone = (String) nextServe.get("phone");

                jdbc.update("UPDATE tokens SET status = 'serving', served_at = NOW() WHERE id = :id",
                        Map.of("id", nextServeId));
                nextServingId = nextServeId;
                sendTurnNotification(nextServePhone, nextServeId);

                if (nextWaiting.size() > 1) {
                    Map<String, Object> nextInLine = nextWaiting.get(1);
                    sendNextInLineNotification((String) nextInLine.get("phone"), (Integer) nextInLine.get("id"));
                }
            }

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
}
