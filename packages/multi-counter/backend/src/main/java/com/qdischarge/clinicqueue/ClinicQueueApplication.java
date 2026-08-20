package com.qdischarge.clinicqueue;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Entry point for the Spring Boot port of the Node/Express "qDischarge"
 * clinic queue backend. Boots an embedded Tomcat server, initializes the
 * "tokens" table on startup, and exposes the same /api/queue and /webhook
 * routes as the original backend/index.js.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class ClinicQueueApplication {

    public static void main(String[] args) {
        SpringApplication.run(ClinicQueueApplication.class, args);
    }
}
