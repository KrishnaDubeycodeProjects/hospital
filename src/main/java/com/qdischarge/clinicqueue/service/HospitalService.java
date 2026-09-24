package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.catalog.MedicalCategory;
import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.CreateHospitalRequest;
import com.qdischarge.clinicqueue.dto.HospitalDto;
import com.qdischarge.clinicqueue.dto.SetLocationRequest;
import com.qdischarge.clinicqueue.geo.DigipinService;
import com.qdischarge.clinicqueue.geo.GeoDistanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Hospital directory: location (DIGIPIN-based), OPD hours, counter count,
 * and profile (ownership/year established/accreditation/gender-specific/
 * offered categories -- see catalog.MedicalCategory). A hospital's
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
    private final GeoDistanceService geoDistanceService;
    private final HospitalDepartmentService hospitalDepartmentService;
    private final AppProperties appProperties;

    /**
     * categories/accreditation are stored as comma-separated TEXT (not a
     * Postgres array -- see schema.sql), so HospitalDto can't be mapped
     * with a plain BeanPropertyRowMapper.
     */
    private static final RowMapper<HospitalDto> ROW_MAPPER = (rs, rowNum) -> HospitalDto.builder()
            .id(rs.getInt("id"))
            .uriSlug(rs.getString("uri_slug"))
            .name(rs.getString("name"))
            .address(rs.getString("address"))
            .digipin(rs.getString("digipin"))
            .latitude(rs.getDouble("latitude"))
            .longitude(rs.getDouble("longitude"))
            .openTime(rs.getObject("open_time", LocalTime.class))
            .closeTime(rs.getObject("close_time", LocalTime.class))
            .avgServiceMinutes(rs.getInt("avg_service_minutes"))
            .minServiceMinutes((Integer) rs.getObject("min_service_minutes"))
            .activeCounters(rs.getInt("active_counters"))
            .ownership(rs.getString("ownership"))
            .yearEstablished((Integer) rs.getObject("year_established"))
            .accreditation(splitCsv(rs.getString("accreditation")))
            .genderSpecific(rs.getString("gender_specific"))
            .categories(splitCsv(rs.getString("categories")))
            .urgentReferralQuota(getNullableInt(rs, "urgent_referral_quota", 5))
            .standardReferralQuota(getNullableInt(rs, "standard_referral_quota", 15))
            .createdAt(rs.getObject("created_at", LocalDateTime.class))
            .updatedAt(rs.getObject("updated_at", LocalDateTime.class))
            .build();

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
            // schema.sql always seeds a 'main' row; if a custom slug was configured
            // without creating that hospital yet, fall back to it so the single-
            // counter flows (which need *a* hospital) never hard-fail.
            hospital = getBySlug("main");
        }
        return hospital;
    }

    @Cacheable(value = "hospitals")
    public List<HospitalDto> list() {
        return jdbc.query("SELECT * FROM hospitals ORDER BY name ASC", ROW_MAPPER).stream()
                .map(this::finish).toList();
    }

    public record HospitalMatch(HospitalDto hospital, double distanceKm) {
    }

    public record HospitalSearchPage(List<HospitalMatch> results, boolean hasMore) {
    }

    /**
     * Hospitals offering the given category (case-insensitive, or every
     * category if null), open to the given patient gender (a hospital with
     * no gender_specific flag accepts everyone; one flagged "male"/"female"
     * only accepts a matching patient gender -- a patient who is "other"
     * only matches unflagged hospitals; gender null skips this filter
     * entirely), nearest first. offset/limit page through the ranked list --
     * the WhatsApp booking flow and the "share your location" web page both
     * show 20 at a time with a "Show more"/"Load more" for the next page
     * (see QueueManagerService#searchAndOfferHospitals, HospitalController#nearby).
     */
    public HospitalSearchPage searchHospitals(String category, String gender, Double lat, Double lon, int offset, int limit) {
        if (lat == null || lon == null) {
            HospitalDto operating = getOperatingHospital();
            if (operating != null && operating.getLatitude() != null && operating.getLongitude() != null) {
                lat = operating.getLatitude();
                lon = operating.getLongitude();
            } else {
                lat = 19.2183;
                lon = 72.9781;
            }
        }
        final double finalLat = lat;
        final double finalLon = lon;

        List<HospitalDto> candidates = list().stream()
                .filter(h -> category == null || (h.getCategories() != null
                        && h.getCategories().stream().anyMatch(c -> c.equalsIgnoreCase(category))))
                .filter(h -> gender == null || h.getGenderSpecific() == null || h.getGenderSpecific().equalsIgnoreCase(gender))
                .toList();

        List<HospitalMatch> ranked = candidates.stream()
                .map(h -> new HospitalMatch(h, geoDistanceService.distanceKm(finalLat, finalLon, h.getLatitude(), h.getLongitude())))
                .sorted(Comparator.comparingDouble(HospitalMatch::distanceKm))
                .toList();

        int from = Math.min(offset, ranked.size());
        int to = Math.min(offset + limit, ranked.size());
        return new HospitalSearchPage(ranked.subList(from, to), to < ranked.size());
    }

    /** Same fallback schema.sql's placeholder row and DEFAULT clause use: a 9-to-5, 8-hour OPD day. */
    private static final long DEFAULT_OPEN_MINUTES = 480;

    @CacheEvict(value = "hospitals", allEntries = true)
    public HospitalDto create(CreateHospitalRequest req) {
        LatLon resolved = resolveLocation(req.location());
        LocalTime open = req.openTime() != null ? LocalTime.parse(req.openTime()) : LocalTime.of(9, 0);
        LocalTime close = req.closeTime() != null ? LocalTime.parse(req.closeTime()) : LocalTime.of(17, 0);
        int avgServiceMinutes = resolveAvgServiceMinutes(req, open, close);
        if (req.minServiceMinutes() != null && req.minServiceMinutes() > avgServiceMinutes) {
            throw new IllegalArgumentException("minServiceMinutes cannot exceed avgServiceMinutes.");
        }

        if (req.genderSpecific() != null && !req.genderSpecific().isBlank()
                && !req.genderSpecific().equalsIgnoreCase("male") && !req.genderSpecific().equalsIgnoreCase("female")) {
            throw new IllegalArgumentException("genderSpecific must be \"male\" or \"female\" (or omitted for general/co-ed).");
        }
        List<String> canonicalCategories = canonicalizeCategories(req.categories());

        // doctor_join_code and the new profile columns (ownership onward): a fresh join-code
        // candidate is always generated, but on an upsert of an already-existing hospital,
        // COALESCE keeps whatever value it already had unless this call explicitly supplies a
        // new one -- a doctor's saved join code (or an admin-edited profile field) must never
        // silently change/reset just because HospitalSeedRunner re-upserts on every boot without
        // knowing about it.
        String sql = """
                INSERT INTO hospitals (uri_slug, name, address, digipin, latitude, longitude, open_time, close_time,
                    avg_service_minutes, min_service_minutes, active_counters, doctor_join_code, ownership, year_established, accreditation,
                    gender_specific, categories)
                VALUES (:slug, :name, :address, :digipin, :lat, :lon, :open, :close, :avgService, :minService, :counters, :joinCode,
                    :ownership, :yearEstablished, :accreditation, :genderSpecific, :categories)
                ON CONFLICT (uri_slug) DO UPDATE SET
                    name = EXCLUDED.name, address = EXCLUDED.address, digipin = EXCLUDED.digipin,
                    latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
                    open_time = EXCLUDED.open_time, close_time = EXCLUDED.close_time,
                    avg_service_minutes = EXCLUDED.avg_service_minutes,
                    min_service_minutes = COALESCE(EXCLUDED.min_service_minutes, hospitals.min_service_minutes),
                    active_counters = EXCLUDED.active_counters,
                    doctor_join_code = COALESCE(hospitals.doctor_join_code, EXCLUDED.doctor_join_code),
                    ownership = COALESCE(EXCLUDED.ownership, hospitals.ownership),
                    year_established = COALESCE(EXCLUDED.year_established, hospitals.year_established),
                    accreditation = COALESCE(EXCLUDED.accreditation, hospitals.accreditation),
                    gender_specific = COALESCE(EXCLUDED.gender_specific, hospitals.gender_specific),
                    categories = COALESCE(EXCLUDED.categories, hospitals.categories),
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
                """;
        Map<String, Object> params = new java.util.HashMap<>();
        params.put("slug", req.uriSlug());
        params.put("name", req.name());
        params.put("address", req.address() == null ? "" : req.address());
        params.put("digipin", resolved.digipin());
        params.put("lat", resolved.lat());
        params.put("lon", resolved.lon());
        params.put("open", open);
        params.put("close", close);
        params.put("avgService", avgServiceMinutes);
        params.put("minService", req.minServiceMinutes());
        params.put("counters", req.activeCounters() == null ? 1 : req.activeCounters());
        params.put("joinCode", generateJoinCode());
        params.put("ownership", req.ownership());
        params.put("yearEstablished", req.yearEstablished());
        params.put("accreditation", joinCsv(req.accreditation()));
        params.put("genderSpecific", req.genderSpecific() == null ? null : req.genderSpecific().toLowerCase());
        params.put("categories", joinCsv(canonicalCategories));

        List<HospitalDto> rows = jdbc.query(sql, params, ROW_MAPPER);
        HospitalDto hospital = finish(rows.get(0));
        if (canonicalCategories != null) {
            hospitalDepartmentService.syncFromHospital(hospital.getId(), canonicalCategories);
        }
        return hospital;
    }

    private List<String> canonicalizeCategories(List<String> categories) {
        if (categories == null) {
            return null;
        }
        List<String> canonical = new ArrayList<>();
        for (String c : categories) {
            String match = MedicalCategory.canonicalize(c);
            if (match == null) {
                throw new IllegalArgumentException("Unknown category: \"" + c + "\". See GET /api/hospitals/categories for the valid list.");
            }
            canonical.add(match);
        }
        return canonical;
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

    @CacheEvict(value = "hospitals", allEntries = true)
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

    private static List<String> splitCsv(String csv) {
        if (csv == null || csv.isBlank()) {
            return null;
        }
        return Arrays.stream(csv.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    private static String joinCsv(List<String> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        return String.join(", ", values);
    }

    private static Integer getNullableInt(java.sql.ResultSet rs, String col, int defaultValue) {
        try {
            Object obj = rs.getObject(col);
            return obj != null ? ((Number) obj).intValue() : defaultValue;
        } catch (java.sql.SQLException e) {
            return defaultValue;
        }
    }


    public record LatLon(String digipin, double lat, double lon) {
    }
}
