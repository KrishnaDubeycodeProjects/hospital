package com.qdischarge.clinicqueue.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Java equivalent of backend/utils/db.js#initializeDatabase(). Runs once on
 * startup and is idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS), so it
 * is safe to run against an already-provisioned Supabase/Postgres database.
 *
 * Like the original, a failure here is logged but does not stop the app from
 * starting (index.js did initializeDatabase().catch(err => console.error(...))
 * rather than crashing the process).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DatabaseInitializer implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    private static final String DDL = """
            CREATE TABLE IF NOT EXISTS tokens (
              id SERIAL PRIMARY KEY,
              phone VARCHAR(50) NOT NULL,
              name VARCHAR(100) NOT NULL,
              status VARCHAR(20) DEFAULT 'waiting',
              session_step VARCHAR(50) DEFAULT 'welcome',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              served_at TIMESTAMP NULL,
              completed_at TIMESTAMP NULL,
              missed_at TIMESTAMP NULL,
              is_verified BOOLEAN DEFAULT FALSE,
              verified_at TIMESTAMP NULL
            );
            ALTER TABLE tokens ADD COLUMN IF NOT EXISTS session_step VARCHAR(50) DEFAULT 'welcome';
            ALTER TABLE tokens ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
            ALTER TABLE tokens ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP NULL;
            """;

    @Override
    public void run(ApplicationArguments args) {
        try {
            jdbcTemplate.execute(DDL);
            log.info("Checked/Created \"tokens\" table successfully.");
        } catch (Exception e) {
            log.error("⚠️ Database initialization failed at startup: {}", e.getMessage());
        }
    }
}
