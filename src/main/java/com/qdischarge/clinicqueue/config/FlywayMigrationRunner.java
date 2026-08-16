package com.qdischarge.clinicqueue.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.Flyway;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/**
 * Runs Flyway migrations (src/main/resources/db/migration) manually rather
 * than via Spring Boot's auto-configured Flyway integration
 * (spring.flyway.enabled=false), so a DB outage at boot is logged and
 * swallowed instead of failing the whole application context -- matching
 * the original Node backend's initializeDatabase().catch(err => ...), which
 * logs and keeps the server running.
 *
 * @Order(1) so this runs before HospitalSeedRunner, which needs the schema
 * this creates to already exist.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@Order(1)
public class FlywayMigrationRunner implements ApplicationRunner {

    private final DataSource dataSource;

    @Override
    public void run(ApplicationArguments args) {
        try {
            Flyway flyway = Flyway.configure()
                    .dataSource(dataSource)
                    .baselineOnMigrate(true)
                    .load();
            flyway.migrate();
            log.info("Database schema is up to date.");
        } catch (Exception e) {
            log.error("⚠️ Database migration failed at startup: {}", e.getMessage());
        }
    }
}
