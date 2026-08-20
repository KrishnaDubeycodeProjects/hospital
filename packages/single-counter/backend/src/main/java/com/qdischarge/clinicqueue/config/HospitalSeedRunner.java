package com.qdischarge.clinicqueue.config;

import com.qdischarge.clinicqueue.dto.CreateHospitalRequest;
import com.qdischarge.clinicqueue.dto.SetLocationRequest;
import com.qdischarge.clinicqueue.service.HospitalService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Upserts the single operating hospital's row (uri_slug = app.hospital-uri-slug)
 * from HOSPITAL_* env vars on every boot -- the same "config is the source of
 * truth, DB just mirrors it" pattern as AdminAuthService's credential handling.
 * Runs after FlywayMigrationRunner (@Order(2)) so the "hospitals" table exists.
 * If neither a DIGIPIN nor lat/lon is configured, it leaves whatever's already
 * in the DB (e.g. the migration's placeholder row) alone -- location is meant
 * to be set explicitly, via env vars or the admin API, not guessed at.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@Order(2)
public class HospitalSeedRunner implements ApplicationRunner {

    private final HospitalService hospitalService;
    private final AppProperties appProperties;

    @Override
    public void run(ApplicationArguments args) {
        boolean hasDigipin = appProperties.getHospitalDigipin() != null && !appProperties.getHospitalDigipin().isBlank();
        boolean hasLatLon = appProperties.getHospitalLatitude() != null && appProperties.getHospitalLongitude() != null;

        if (!hasDigipin && !hasLatLon) {
            log.info("No HOSPITAL_DIGIPIN or HOSPITAL_LATITUDE/LONGITUDE configured; leaving hospital '{}' location as-is.",
                    appProperties.getHospitalUriSlug());
            return;
        }

        try {
            SetLocationRequest location = hasDigipin
                    ? new SetLocationRequest(appProperties.getHospitalDigipin(), null, null)
                    : new SetLocationRequest(null, appProperties.getHospitalLatitude(), appProperties.getHospitalLongitude());

            hospitalService.create(new CreateHospitalRequest(
                    appProperties.getHospitalUriSlug(),
                    appProperties.getClinicName(),
                    null,
                    location,
                    appProperties.getHospitalOpenTime(),
                    appProperties.getHospitalCloseTime(),
                    appProperties.getAvgServiceMinutes(),
                    appProperties.getHospitalActiveCounters()
            ));
            log.info("Hospital '{}' location seeded from configuration.", appProperties.getHospitalUriSlug());
        } catch (Exception e) {
            log.error("⚠️ Failed to seed hospital location at startup: {}", e.getMessage());
        }
    }
}
