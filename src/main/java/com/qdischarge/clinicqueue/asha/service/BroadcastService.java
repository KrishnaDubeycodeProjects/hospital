package com.qdischarge.clinicqueue.asha.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * NHM broadcasts: a CHO (to her sector) or an ADMIN (to everyone) sends a work message to ASHA / ANM
 * workers; each worker can mark it read / done. Soft-delete only (is_deleted), never DELETE FROM.
 *
 * A worker's broadcast senders are resolved through the cadre chain in asha_workers:
 * ASHA.anm_phone → (ANM or CHO), ANM.anm_phone → CHO. Phones are compared on their last 10 digits.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BroadcastService {

    public static final Set<String> PRIORITIES = Set.of("NORMAL", "URGENT");
    public static final Set<String> AUDIENCES = Set.of("ALL", "ASHA", "ANM");
    static final int MAX_TITLE = 120;
    static final int MAX_MESSAGE = 2000;

    private static final String D10 = "RIGHT(regexp_replace(COALESCE(%s, ''), '[^0-9]', '', 'g'), 10)";

    private final NamedParameterJdbcTemplate jdbc;
    private final AtomicBoolean schemaReady = new AtomicBoolean(false);

    private static String d10(String column) {
        return String.format(D10, column);
    }

    public static String lastTenDigits(String phone) {
        return ChoReferralService.lastTenDigits(phone);
    }

    public void ensureSchema() {
        if (schemaReady.get()) return;
        String[] ddl = {
            "CREATE TABLE IF NOT EXISTS clinicqueue.nhm_broadcasts (" +
                "id SERIAL PRIMARY KEY, sender_phone VARCHAR(50) NOT NULL, sender_role VARCHAR(10) NOT NULL, " +
                "sender_name VARCHAR(150), title VARCHAR(150) NOT NULL, message TEXT NOT NULL, " +
                "priority VARCHAR(10) NOT NULL DEFAULT 'NORMAL', audience VARCHAR(10) NOT NULL DEFAULT 'ALL', " +
                "due_date DATE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                "is_deleted BOOLEAN NOT NULL DEFAULT FALSE)",
            "CREATE INDEX IF NOT EXISTS idx_nb_sender ON clinicqueue.nhm_broadcasts (sender_phone)",
            "CREATE TABLE IF NOT EXISTS clinicqueue.nhm_broadcast_acks (" +
                "broadcast_id INT NOT NULL REFERENCES clinicqueue.nhm_broadcasts(id), " +
                "worker_phone VARCHAR(20) NOT NULL, read_at TIMESTAMP, done_at TIMESTAMP, " +
                "PRIMARY KEY (broadcast_id, worker_phone))",
        };
        for (String sql : ddl) jdbc.getJdbcTemplate().execute(sql);
        schemaReady.set(true);
    }

    /** Validated input for a new broadcast. */
    public record NewBroadcast(String title, String message, String priority, String audience, LocalDate dueDate) {}

    /** @return the new broadcast id. */
    public int create(String senderPhone, String senderRole, String senderName, NewBroadcast b) {
        ensureSchema();
        Integer id = jdbc.queryForObject(
                "INSERT INTO clinicqueue.nhm_broadcasts (sender_phone, sender_role, sender_name, title, message, priority, audience, due_date) " +
                        "VALUES (:phone, :role, :name, :title, :message, :priority, :audience, :due) RETURNING id",
                new MapSqlParameterSource("phone", senderPhone)
                        .addValue("role", senderRole)
                        .addValue("name", senderName)
                        .addValue("title", b.title())
                        .addValue("message", b.message())
                        .addValue("priority", b.priority())
                        .addValue("audience", b.audience())
                        .addValue("due", b.dueDate()),
                Integer.class);
        log.info("Broadcast {} created by {} {} for {}", id, senderRole, senderPhone, b.audience());
        return id != null ? id : 0;
    }

    /** SQL for the 10-digit phones of everyone a broadcast from this worker's CHO / ANM chain may come from. */
    private static final String SENDERS_OF_WORKER =
            "SELECT " + d10("a.anm_phone") + " FROM clinicqueue.asha_workers a WHERE " + d10("a.phone") + " = :w " +
            "UNION SELECT " + d10("b.anm_phone") + " FROM clinicqueue.asha_workers a " +
            "JOIN clinicqueue.asha_workers b ON " + d10("b.phone") + " = " + d10("a.anm_phone") +
            " WHERE " + d10("a.phone") + " = :w";

    /** Broadcasts addressed to this worker (newest / urgent first) with her own read / done state. */
    public List<Map<String, Object>> inbox(String workerPhone, String workerRole) {
        ensureSchema();
        String sql = """
            SELECT b.id AS "id", b.title AS "title", b.message AS "message", b.priority AS "priority",
                   b.audience AS "audience", b.due_date AS "dueDate", b.created_at AS "createdAt",
                   b.sender_role AS "senderRole", b.sender_name AS "senderName",
                   k.read_at AS "readAt", k.done_at AS "doneAt"
            FROM clinicqueue.nhm_broadcasts b
            LEFT JOIN clinicqueue.nhm_broadcast_acks k ON k.broadcast_id = b.id AND k.worker_phone = :w
            WHERE b.is_deleted = FALSE
              AND b.audience IN ('ALL', :role)
              AND (b.sender_role = 'ADMIN' OR %s IN (%s))
            ORDER BY (k.done_at IS NOT NULL), (b.priority = 'URGENT') DESC, b.created_at DESC
            LIMIT 100
            """.formatted(d10("b.sender_phone"), SENDERS_OF_WORKER);
        return jdbc.queryForList(sql, new MapSqlParameterSource("w", lastTenDigits(workerPhone)).addValue("role", workerRole));
    }

    /** True when the broadcast exists and is addressed to this worker. */
    public boolean isAddressedTo(int broadcastId, String workerPhone, String workerRole) {
        ensureSchema();
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM clinicqueue.nhm_broadcasts b WHERE b.id = :id AND b.is_deleted = FALSE " +
                        "AND b.audience IN ('ALL', :role) AND (b.sender_role = 'ADMIN' OR " + d10("b.sender_phone") +
                        " IN (" + SENDERS_OF_WORKER + "))",
                new MapSqlParameterSource("id", broadcastId).addValue("w", lastTenDigits(workerPhone)).addValue("role", workerRole),
                Integer.class);
        return n != null && n > 0;
    }

    /** Idempotent read / done mark (done implies read). */
    public void acknowledge(int broadcastId, String workerPhone, boolean done) {
        ensureSchema();
        jdbc.update(
                "INSERT INTO clinicqueue.nhm_broadcast_acks (broadcast_id, worker_phone, read_at, done_at) " +
                        "VALUES (:id, :w, CURRENT_TIMESTAMP, CASE WHEN CAST(:done AS BOOLEAN) THEN CURRENT_TIMESTAMP END) " +
                        "ON CONFLICT (broadcast_id, worker_phone) DO UPDATE SET " +
                        "read_at = COALESCE(clinicqueue.nhm_broadcast_acks.read_at, EXCLUDED.read_at), " +
                        "done_at = COALESCE(clinicqueue.nhm_broadcast_acks.done_at, EXCLUDED.done_at)",
                new MapSqlParameterSource("id", broadcastId).addValue("w", lastTenDigits(workerPhone)).addValue("done", done));
    }

    /** Broadcasts this sender created, with how many workers read / completed each. */
    public List<Map<String, Object>> sent(String senderPhone) {
        ensureSchema();
        return jdbc.queryForList("""
            SELECT b.id AS "id", b.title AS "title", b.message AS "message", b.priority AS "priority",
                   b.audience AS "audience", b.due_date AS "dueDate", b.created_at AS "createdAt",
                   COUNT(k.read_at) AS "readCount", COUNT(k.done_at) AS "doneCount"
            FROM clinicqueue.nhm_broadcasts b
            LEFT JOIN clinicqueue.nhm_broadcast_acks k ON k.broadcast_id = b.id
            WHERE b.is_deleted = FALSE AND %s = :s
            GROUP BY b.id ORDER BY b.created_at DESC LIMIT 100
            """.formatted(d10("b.sender_phone")),
                new MapSqlParameterSource("s", lastTenDigits(senderPhone)));
    }

    /** Soft-delete (withdraw) a broadcast; only its own sender may do so. */
    public boolean withdraw(int broadcastId, String senderPhone) {
        ensureSchema();
        return jdbc.update(
                "UPDATE clinicqueue.nhm_broadcasts SET is_deleted = TRUE WHERE id = :id AND is_deleted = FALSE AND " +
                        d10("sender_phone") + " = :s",
                new MapSqlParameterSource("id", broadcastId).addValue("s", lastTenDigits(senderPhone))) > 0;
    }
}
