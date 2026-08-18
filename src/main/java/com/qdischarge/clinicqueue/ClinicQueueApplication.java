package com.qdischarge.clinicqueue;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Entry point for the Spring Boot port of the Node/Express "qDischarge"
 * clinic queue backend. Boots an embedded Tomcat server, initializes the
 * "tokens" table on startup, and exposes the same /api/queue and /webhook
 * routes as the original backend/index.js.
 *
 * @EnableScheduling backs service.TreatmentTimingScheduler's periodic
 * re-evaluation of the active queue (real-ETA "go now" triggers +
 * anomaly-control deadline expiry) -- see that class for details.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class ClinicQueueApplication {

    public static void main(String[] args) {
        SpringApplication.run(ClinicQueueApplication.class, args);
    }
}
