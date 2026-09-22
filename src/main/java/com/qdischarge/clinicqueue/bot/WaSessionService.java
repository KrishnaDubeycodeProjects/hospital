package com.qdischarge.clinicqueue.bot;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Tracks, per phone number, which language a WhatsApp bot session has picked
 * (see the wa_sessions table in schema.sql). Deliberately independent of the tokens table:
 * a phone needs a language *before* it has any token row (during the
 * greeting/picker exchange), and keeps it across tokens (new token, cancelled
 * token, completed visit, ...).
 */
@Service
@RequiredArgsConstructor
public class WaSessionService {

    private final NamedParameterJdbcTemplate jdbc;

    public record WaSession(String phone, Lang language, String stage, String prevStage) {
        public boolean awaitingLanguage() {
            return language == null;
        }
    }

    public record PendingMedia(String mediaId, String mediaType, Integer memberId) {}

    /** Null if this phone has never messaged the bot before. */
    public WaSession get(String phone) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT phone, language, stage, prev_stage FROM wa_sessions WHERE phone = :phone", Map.of("phone", phone));
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> row = rows.get(0);
        return new WaSession(phone, Lang.fromCode((String) row.get("language")), (String) row.get("stage"), (String) row.get("prev_stage"));
    }

    /** First-ever contact from this phone: open a session with no language chosen yet. */
    public void createAwaitingLanguage(String phone) {
        jdbc.update(
                "INSERT INTO wa_sessions (phone, language, stage) VALUES (:phone, NULL, 'awaiting_language') " +
                        "ON CONFLICT (phone) DO NOTHING",
                Map.of("phone", phone));
    }

    public void setLanguage(String phone, Lang language) {
        jdbc.update(
                """
                INSERT INTO wa_sessions (phone, language, stage, updated_at)
                VALUES (:phone, :language, 'ready', NOW())
                ON CONFLICT (phone) DO UPDATE SET language = :language, stage = 'ready', updated_at = NOW()
                """,
                Map.of("phone", phone, "language", language.name()));
    }

    public void setStage(String phone, String stage) {
        jdbc.update(
                """
                INSERT INTO wa_sessions (phone, stage, updated_at)
                VALUES (:phone, :stage, NOW())
                ON CONFLICT (phone) DO UPDATE SET prev_stage = wa_sessions.stage, stage = :stage, updated_at = NOW()
                """,
                Map.of("phone", phone, "stage", stage));
    }

    public void setPrevStage(String phone, String prevStage) {
        jdbc.update("UPDATE wa_sessions SET prev_stage = :prevStage WHERE phone = :phone", 
                Map.of("phone", phone, "prevStage", prevStage == null ? "" : prevStage));
    }

    public String getPrevStage(String phone) {
        List<String> rows = jdbc.queryForList(
                "SELECT prev_stage FROM wa_sessions WHERE phone = :phone", Map.of("phone", phone), String.class);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public void setPendingMedia(String phone, String mediaId, String mediaType, Integer memberId) {
        jdbc.update(
                """
                UPDATE wa_sessions SET pending_media_id = :mediaId, pending_media_type = :mediaType, 
                pending_member_id = :memberId WHERE phone = :phone
                """,
                Map.of("phone", phone, "mediaId", mediaId, "mediaType", mediaType, "memberId", memberId));
    }

    public void clearPendingMedia(String phone) {
        jdbc.update(
                """
                UPDATE wa_sessions SET pending_media_id = NULL, pending_media_type = NULL, 
                pending_member_id = NULL WHERE phone = :phone
                """,
                Map.of("phone", phone));
    }

    public PendingMedia getPendingMedia(String phone) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT pending_media_id, pending_media_type, pending_member_id FROM wa_sessions WHERE phone = :phone", Map.of("phone", phone));
        if (rows.isEmpty() || rows.get(0).get("pending_media_id") == null) {
            return null;
        }
        Map<String, Object> row = rows.get(0);
        return new PendingMedia((String) row.get("pending_media_id"), (String) row.get("pending_media_type"), (Integer) row.get("pending_member_id"));
    }

    public void resetToLanguagePicker(String phone) {
        jdbc.update(
                """
                UPDATE wa_sessions SET language = NULL, stage = 'awaiting_language', 
                prev_stage = NULL, pending_media_id = NULL WHERE phone = :phone
                """,
                Map.of("phone", phone));
    }
}
