package com.qdischarge.clinicqueue.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;

/**
 * Applies src/main/resources/schema.sql (plain, idempotent DDL -- every
 * statement is CREATE/ADD COLUMN ... IF NOT EXISTS) on every boot, run
 * manually rather than via Spring Boot's auto-configured SQL initializer
 * (spring.sql.init.mode=never) because that initializer treats a failed-to-
 * connect DB at boot as fatal and crashes the whole application context --
 * its continue-on-error setting only covers failures *within* an already-
 * connected script run. This runner instead swallows any failure (DB
 * unreachable, or a bad statement) so a DB outage at startup is logged and
 * doesn't take the app down with it -- matching the original Node backend's
 * initializeDatabase().catch(err => ...), which logs and keeps the server
 * running, and the same non-fatal shape the old Flyway-based runner had.
 *
 * @Order(1) so this runs before HospitalSeedRunner, which needs the schema
 * this creates to already exist.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@Order(1)
public class SchemaInitRunner implements ApplicationRunner {

    private final DataSource dataSource;

    @Override
    public void run(ApplicationArguments args) {
        try (Connection connection = dataSource.getConnection()) {
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("schema.sql"));
            log.info("Database schema is up to date.");
        } catch (Exception e) {
            // Swallowed on purpose (see class javadoc), but log the full cause chain --
            // logging only e.getMessage() here would hide *why* schema init failed (e.g.
            // a bad statement never applying), which would then surface later as
            // confusing "bad SQL grammar" errors from unrelated queries that assumed a
            // new column/table already existed.
            log.error("⚠️ Database schema initialization failed at startup -- schema may be out of date", e);
        }
    }
}
