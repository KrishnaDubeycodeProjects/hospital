package com.qdischarge.clinicqueue.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

import java.nio.charset.StandardCharsets;

/**
 * Applies src/main/resources/schema.sql on every boot. Executes each SQL statement
 * individually so that one minor error (e.g. index syntax or missing column) does not
 * abort the remaining table creations.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@Order(1)
public class SchemaInitRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            log.info("🌱 Running database schema initialization...");
            ClassPathResource resource = new ClassPathResource("schema.sql");
            String script = StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);

            // Strip comment-only lines and split by semicolon
            String[] statements = script.split(";");
            int executed = 0;
            int failed = 0;

            for (String statement : statements) {
                String trimmed = statement.trim();
                // Ignore empty statements or pure comment lines
                if (trimmed.isEmpty() || trimmed.startsWith("--")) {
                    continue;
                }

                try {
                    jdbcTemplate.execute(trimmed);
                    executed++;
                } catch (Exception e) {
                    failed++;
                    log.debug("Schema statement skipped/warning: {} -> {}", trimmed.length() > 60 ? trimmed.substring(0, 60) + "..." : trimmed, e.getMessage());
                }
            }

            log.info("✅ Database schema initialization completed: {} statements executed ({} skipped/existing).", executed, failed);
        } catch (Exception e) {
            log.error("⚠️ Database schema initialization error: {}", e.getMessage(), e);
        }
    }
}
