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

    public record WaSession(String phone, Lang language, String stage) {
        public boolean awaitingLanguage() {
            return language == null;
        }
    }

    /** Null if this phone has never messaged the bot before. */
    public WaSession get(String phone) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT phone, language, stage FROM wa_sessions WHERE phone = :phone", Map.of("phone", phone));
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> row = rows.get(0);
        return new WaSession(phone, Lang.fromCode((String) row.get("language")), (String) row.get("stage"));
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
}
