package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.CreateHospitalRequest;
import com.qdischarge.clinicqueue.dto.HospitalDto;
import com.qdischarge.clinicqueue.dto.SetLocationRequest;
import com.qdischarge.clinicqueue.geo.DigipinService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

/**
 * Hospital location (DIGIPIN-based), OPD hours, and counter count. A hospital's
 * "location" is deliberately just a DIGIPIN + the lat/lon it decodes to --
 * settable either directly as a DIGIPIN or as raw lat/lon (a DIGIPIN is then
 * derived), which is what "setting the location to a hospital URI" means in
 * practice: every hospital has a stable uriSlug and a DIGIPIN address.
 */
@Service
@RequiredArgsConstructor
public class HospitalService {

    private final NamedParameterJdbcTemplate jdbc;
    private final DigipinService digipinService;
    private final AppProperties appProperties;

    private static final RowMapper<HospitalDto> ROW_MAPPER = new BeanPropertyRowMapper<>(HospitalDto.class);
    /** Excludes 0/O/1/I/L -- easy to read aloud/type when handing a doctor their hospital's join code. */
    private static final String JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    public HospitalDto getBySlug(String uriSlug) {
        List<HospitalDto> rows = jdbc.query(
                "SELECT * FROM hospitals WHERE uri_slug = :slug", Map.of("slug", uriSlug), ROW_MAPPER);
        return finish(rows.isEmpty() ? null : rows.get(0));
    }

    public HospitalDto getById(int id) {
        List<HospitalDto> rows = jdbc.query(
                "SELECT * FROM hospitals WHERE id = :id", Map.of("id", id), ROW_MAPPER);
        return finish(rows.isEmpty() ? null : rows.get(0));
    }

    /** The hospital this single-tenant deployment operates as (app.hospital-uri-slug). */
    public HospitalDto getOperatingHospital() {
        HospitalDto hospital = getBySlug(appProperties.getHospitalUriSlug());
        if (hospital == null) {
            // Migration always seeds a 'main' row; if a custom slug was configured
            // without creating that hospital yet, fall back to it so the single-
            // counter flows (which need *a* hospital) never hard-fail.
            hospital = getBySlug("main");
        }
        return hospital;
    }

    public List<HospitalDto> list() {
        return jdbc.query("SELECT * FROM hospitals ORDER BY name ASC", ROW_MAPPER).stream()
                .map(this::finish).toList();
    }

    /** Same fallback the DB migration's placeholder row and DEFAULT clause use: a 9-to-5, 8-hour OPD day. */
    private static final long DEFAULT_OPEN_MINUTES = 480;

    public HospitalDto create(CreateHospitalRequest req) {
        LatLon resolved = resolveLocation(req.location());
        LocalTime open = req.openTime() != null ? LocalTime.parse(req.openTime()) : LocalTime.of(9, 0);
        LocalTime close = req.closeTime() != null ? LocalTime.parse(req.closeTime()) : LocalTime.of(17, 0);
        int avgServiceMinutes = resolveAvgServiceMinutes(req, open, close);

        // doctor_join_code: a fresh candidate is always generated, but on an upsert of an
        // already-existing hospital, COALESCE keeps whatever code it already had -- a
        // doctor's saved join code must never silently change under them.
        String sql = """
                INSERT INTO hospitals (uri_slug, name, address, digipin, latitude, longitude, open_time, close_time, avg_service_minutes, active_counters, doctor_join_code)
                VALUES (:slug, :name, :address, :digipin, :lat, :lon, :open, :close, :avgService, :counters, :joinCode)
                ON CONFLICT (uri_slug) DO UPDATE SET
                    name = EXCLUDED.name, address = EXCLUDED.address, digipin = EXCLUDED.digipin,
                    latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
                    open_time = EXCLUDED.open_time, close_time = EXCLUDED.close_time,
                    avg_service_minutes = EXCLUDED.avg_service_minutes, active_counters = EXCLUDED.active_counters,
                    doctor_join_code = COALESCE(hospitals.doctor_join_code, EXCLUDED.doctor_join_code),
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
                """;
        List<HospitalDto> rows = jdbc.query(sql, Map.of(
                "slug", req.uriSlug(), "name", req.name(), "address", req.address() == null ? "" : req.address(),
                "digipin", resolved.digipin(), "lat", resolved.lat(), "lon", resolved.lon(),
                "open", open, "close", close,
                "avgService", avgServiceMinutes,
                "counters", req.activeCounters() == null ? 1 : req.activeCounters(),
                "joinCode", generateJoinCode()
        ), ROW_MAPPER);
        return finish(rows.get(0));
    }

    /** Admin-only: the join code doctors enter to link their account to this hospital (never exposed on public reads). */
    public String getDoctorJoinCode(String uriSlug) {
        List<String> rows = jdbc.query(
                "SELECT doctor_join_code FROM hospitals WHERE uri_slug = :slug",
                Map.of("slug", uriSlug), (rs, i) -> rs.getString("doctor_join_code"));
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** Admin-only: rotates the join code (e.g. if it leaked) -- existing doctor<->hospital links are untouched, only future joins need the new code. */
    public String regenerateDoctorJoinCode(String uriSlug) {
        String code = generateJoinCode();
        int updated = jdbc.update(
                "UPDATE hospitals SET doctor_join_code = :code, updated_at = CURRENT_TIMESTAMP WHERE uri_slug = :slug",
                Map.of("code", code, "slug", uriSlug));
        return updated > 0 ? code : null;
    }

    /** Used by DoctorService#joinHospital -- a doctor typing in their hospital's code. */
    public HospitalDto findByDoctorJoinCode(String code) {
        List<HospitalDto> rows = jdbc.query(
                "SELECT * FROM hospitals WHERE doctor_join_code = :code", Map.of("code", code), ROW_MAPPER);
        return rows.isEmpty() ? null : finish(rows.get(0));
    }

    private String generateJoinCode() {
        StringBuilder sb = new StringBuilder(10);
        for (int i = 0; i < 10; i++) {
            sb.append(JOIN_CODE_ALPHABET.charAt(RANDOM.nextInt(JOIN_CODE_ALPHABET.length())));
        }
        return sb.toString();
    }

    /**
     * avgServiceMinutes (how long one patient's visit takes, which drives
     * every wait-time estimate shown to patients) is normally derived rather
     * than asked for directly: given how many hours the hospital is open and
     * how many patients it treats on an average day, one patient's share of
     * the day is (open minutes) / (patients per day). An explicit
     * avgServiceMinutes always overrides that math; with neither given, falls
     * back to the original flat default of 10 minutes/patient.
     */
    private int resolveAvgServiceMinutes(CreateHospitalRequest req, LocalTime open, LocalTime close) {
        if (req.avgServiceMinutes() != null) {
            return req.avgServiceMinutes();
        }
        if (req.avgPatientsPerDay() != null) {
            long openMinutes = java.time.Duration.between(open, close).toMinutes();
            if (openMinutes <= 0) {
                openMinutes = DEFAULT_OPEN_MINUTES;
            }
            return (int) Math.max(1, openMinutes / req.avgPatientsPerDay());
        }
        return 10;
    }

    public HospitalDto updateLocation(String uriSlug, SetLocationRequest location) {
        LatLon resolved = resolveLocation(location);
        List<HospitalDto> rows = jdbc.query(
                """
                UPDATE hospitals
                SET digipin = :digipin, latitude = :lat, longitude = :lon, updated_at = CURRENT_TIMESTAMP
                WHERE uri_slug = :slug
                RETURNING *
                """,
                Map.of("digipin", resolved.digipin(), "lat", resolved.lat(), "lon", resolved.lon(), "slug", uriSlug),
                ROW_MAPPER);
        return rows.isEmpty() ? null : finish(rows.get(0));
    }

    /** Resolves a DIGIPIN-or-lat/lon request into both forms; DIGIPIN is the source of truth when given. */
    public LatLon resolveLocation(SetLocationRequest location) {
        if (location.hasDigipin()) {
            DigipinService.LatLon decoded = digipinService.decode(location.digipin());
            return new LatLon(location.digipin().trim().toUpperCase(), decoded.lat(), decoded.lon());
        }
        if (location.hasLatLon()) {
            String digipin = digipinService.encode(location.latitude(), location.longitude());
            return new LatLon(digipin, location.latitude(), location.longitude());
        }
        throw new IllegalArgumentException("Provide either a digipin or both latitude and longitude.");
    }

    private HospitalDto finish(HospitalDto h) {
        if (h != null && h.getDigipin() != null) {
            h.setFormattedDigipin(digipinService.format(h.getDigipin()));
        }
        return h;
    }

    public record LatLon(String digipin, double lat, double lon) {
    }
}
