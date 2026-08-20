package com.qdischarge.clinicqueue.config;

import com.qdischarge.clinicqueue.dto.CreateHospitalRequest;
import com.qdischarge.clinicqueue.dto.SetLocationRequest;
import com.qdischarge.clinicqueue.service.HospitalService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Upserts the single operating hospital's row (uri_slug = app.hospital-uri-slug)
 * from HOSPITAL_* env vars on every boot -- the same "config is the source of
 * truth, DB just mirrors it" pattern as AdminAuthService's credential handling.
 * The "hospitals" table already exists by the time any ApplicationRunner runs,
 * since Hibernate creates the schema (spring.jpa.hibernate.ddl-auto) during
 * context refresh, before runners execute.
 * If neither a DIGIPIN nor lat/lon is configured, it leaves whatever's already
 * in the DB alone -- location is meant to be set explicitly, via env vars or
 * the admin API, not guessed at.
 */
@Component
@RequiredArgsConstructor
@Slf4j
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
                    // avgPatientsPerDay: not sourced from env vars -- avgServiceMinutes below is given directly instead.
                    null,
                    appProperties.getAvgServiceMinutes(),
                    // minServiceMinutes: admin-API-only, like the profile fields below -- preserved
                    // across re-seeding by HospitalService#create's COALESCE, never wiped by this null.
                    null,
                    appProperties.getHospitalActiveCounters(),
                    // Profile fields (ownership onward) aren't sourced from env vars -- leave them
                    // to the admin API. HospitalService#create preserves whatever's already stored
                    // on every re-seed instead of wiping them out with these nulls.
                    null, null, null, null, null
            ));
            log.info("Hospital '{}' location seeded from configuration.", appProperties.getHospitalUriSlug());
        } catch (Exception e) {
            log.error("⚠️ Failed to seed hospital location at startup: {}", e.getMessage());
        }
    }
}
