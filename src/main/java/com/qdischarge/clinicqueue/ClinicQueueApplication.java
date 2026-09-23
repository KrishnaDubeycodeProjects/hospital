package com.qdischarge.clinicqueue;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Entry point for the AarogyaFlow smart healthcare queue & clinic management system.
 * Boots an embedded Tomcat server, initializes the database on startup,
 * and exposes queue management, patient dashboards, and WhatsApp webhook handlers.
 *
 * @EnableScheduling backs periodic queue re-evaluation, real-ETA triggers,
 * and background hygiene.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
@EnableCaching
public class ClinicQueueApplication {

    public static void main(String[] args) {
        SpringApplication.run(ClinicQueueApplication.class, args);
    }
}
