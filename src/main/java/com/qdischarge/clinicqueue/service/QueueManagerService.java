package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.bot.BotMessages;
import com.qdischarge.clinicqueue.bot.Lang;
import com.qdischarge.clinicqueue.bot.WaSessionService;
import com.qdischarge.clinicqueue.catalog.MedicalCategory;
import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.CreateTokenResult;
import com.qdischarge.clinicqueue.dto.HospitalDto;
import com.qdischarge.clinicqueue.dto.QueueData;
import com.qdischarge.clinicqueue.dto.SetLocationRequest;
import com.qdischarge.clinicqueue.dto.Stats;
import com.qdischarge.clinicqueue.dto.TokenDto;
import com.qdischarge.clinicqueue.dto.TokenHistoryDto;
import com.qdischarge.clinicqueue.dto.UpdateStatusResult;
import com.qdischarge.clinicqueue.geo.GeoDistanceService;
import com.qdischarge.clinicqueue.geo.TomTomRoutingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Java port of backend/utils/queueManager.js, extended with: hospital-aware,
 * DIGIPIN/distance-based patient locations and dynamic "get ready" notification
 * windows (geo/GeoDistanceService), a dedicated missed-token queue with
 * search + requeue-to-front + reject for reception staff, priority-rank
 * based ordering so a requeued token can jump to the front of the line
 * without renumbering everyone else, and a search+select+confirm hospital
 * booking flow (see the "Booking flow" section below).
 *
 * Every queue-shaping method is scoped by (hospitalId, category): a hospital
 * doesn't run one queue, it runs one queue *per department it offers* (see
 * catalog.MedicalCategory / hospital_departments) -- each with its own
 * position counting, missed-queue, and counter assignment. Reads that accept
 * a nullable (hospitalId, category) pair (getQueue/getCurrentServingToken/
 * getMissedQueue/searchMissedQueue) fall back to an unscoped, hospital-wide
 * view when both are omitted, for callers (e.g. today's admin dashboard)
 * that don't yet filter by department.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class QueueManagerService {

    private final NamedParameterJdbcTemplate jdbc;
    private final WhatsAppService whatsAppService;
    private final AppProperties appProperties;
    private final HospitalService hospitalService;
    private final HospitalDepartmentService hospitalDepartmentService;
    private final GeoDistanceService geoDistanceService;
    private final OtpService otpService;
    /** Real routing ETA for the treatment-timing "go now" trigger (see runTreatmentTimingTick). */
    private final TomTomRoutingService tomTomRoutingService;
    /** Voice-call half of the "go now" trigger (see runTreatmentTimingTick). */
    private final TwilioStudioCallService twilioStudioCallService;
    private final BotMessages botMessages;
    /** Per-phone language preference (see resolveLang) -- same source the WhatsApp bot itself uses. */
    private final WaSessionService waSessionService;

    private static final RowMapper<TokenDto> TOKEN_ROW_MAPPER = new BeanPropertyRowMapper<>(TokenDto.class);
    private static final RowMapper<TokenHistoryDto> TOKEN_HISTORY_ROW_MAPPER = new BeanPropertyRowMapper<>(TokenHistoryDto.class);
    /** Ordering expression: a requeued-to-front token's negative priority_rank sorts before every plain id. */
    private static final String QUEUE_ORDER = "COALESCE(priority_rank, id) ASC";
    /** How many hospitals the WhatsApp booking flow shows per page ("5 options, then Show more"). */
    public static final int HOSPITAL_PAGE_SIZE = 20;
    /** R formula headstart: the first 3 genuinely-ahead tokens don't add wait time (see computeTreatmentRemainingMinutes). */
    private static final int ETA_WAITING_HEADSTART_TOKENS = 3;
    /** R formula fixed buffer, in minutes (see computeTreatmentRemainingMinutes). */
    private static final double ETA_FIXED_BUFFER_MINUTES = 2.0;

    // -----------------------------------------------------------------
    // Expired-token cleanup (runs before every read, same as the original)
    // -----------------------------------------------------------------
    private void cleanExpiredTokens() {
        String sql = """
                UPDATE tokens
                SET status = 'missed', missed_at = NOW()
                WHERE status IN ('waiting', 'serving', 'registering_name')
                  AND created_at < NOW() - (:hours || ' hours')::INTERVAL
                """;
        try {
            jdbc.update(sql, Map.of("hours", String.valueOf(appProperties.getTokenExpiryHours())));
        } catch (Exception e) {
            log.error("Error cleaning expired tokens: {}", e.getMessage());
        }
    }

    /** Unscoped, hospital-wide view (today's admin dashboard default). */
    public QueueData getQueue() {
        return getQueue(null, null);
    }

    /** hospitalId/category null = no filter on that dimension (see class docs). */
    public QueueData getQueue(Integer hospitalId, String category) {
        cleanExpiredTokens();

        StringBuilder sql = new StringBuilder("SELECT * FROM tokens WHERE status != 'registering_name'");
        Map<String, Object> params = new HashMap<>();
        appendScope(sql, params, hospitalId, category);
        sql.append(" ORDER BY ").append(QUEUE_ORDER);

        List<TokenDto> tokens = jdbc.query(sql.toString(), params, TOKEN_ROW_MAPPER);

        int total = tokens.size();
        long waiting = tokens.stream().filter(t -> "waiting".equals(t.getStatus())).count();
        long serving = tokens.stream().filter(t -> "serving".equals(t.getStatus())).count();
        long completed = tokens.stream().filter(t -> "completed".equals(t.getStatus())).count();
        long missed = tokens.stream().filter(t -> "missed".equals(t.getStatus())).count();

        Integer currentServing = tokens.stream()
                .filter(t -> "serving".equals(t.getStatus()))
                .map(TokenDto::getId)
                .findFirst()
                .orElse(null);

        Stats stats = new Stats(total, (int) waiting, (int) serving, (int) completed, (int) missed);
        return new QueueData(tokens, currentServing, stats);
    }

    private void appendScope(StringBuilder sql, Map<String, Object> params, Integer hospitalId, String category) {
        if (hospitalId != null) {
            sql.append(" AND hospital_id = :hospitalId");
            params.put("hospitalId", hospitalId);
        }
        if (category != null && !category.isBlank()) {
            sql.append(" AND category = :category");
            params.put("category", category);
        }
    }

    public TokenDto getCurrentServingToken(Integer hospitalId, String category) {
        cleanExpiredTokens();

        StringBuilder sql = new StringBuilder("SELECT * FROM tokens WHERE status = 'serving'");
        Map<String, Object> params = new HashMap<>();
        appendScope(sql, params, hospitalId, category);
        sql.append(" ORDER BY served_at DESC LIMIT 1");

        List<TokenDto> rows = jdbc.query(sql.toString(), params, TOKEN_ROW_MAPPER);
        if (rows.isEmpty()) {
            return null;
        }
        TokenDto t = rows.get(0);
        return TokenDto.builder()
                .id(t.getId()).name(t.getName()).phone(t.getPhone()).status(t.getStatus())
                .sessionStep(t.getSessionStep()).createdAt(t.getCreatedAt()).servedAt(t.getServedAt())
                .counterId(t.getCounterId())
                .build();
    }

    public TokenDto getPatientPosition(String phone) {
        cleanExpiredTokens();

        String sql = """
                SELECT * FROM tokens
                WHERE (phone = :phone OR phone = '+' || :phone OR phone = REPLACE(:phone, '+', '') OR phone LIKE '%' || :phone)
                  AND status IN ('waiting', 'serving')
                LIMIT 1
                """;
        List<TokenDto> rows = jdbc.query(sql, Map.of("phone", phone), TOKEN_ROW_MAPPER);
        if (rows.isEmpty()) {
            return null;
        }
        TokenDto token = rows.get(0);
        QueueData queueData = getQueue(token.getHospitalId(), token.getCategory());

        if ("serving".equals(token.getStatus())) {
            return withGeoFields(TokenDto.builder()
                    .id(token.getId()).name(token.getName()).phone(token.getPhone()).status(token.getStatus())
                    .sessionStep(token.getSessionStep()).position(0).peopleAhead(0)
                    .currentServing(queueData.currentServing())
                    .isVerified(token.getIsVerified()).verifiedAt(token.getVerifiedAt())
                    .build(), token);
        }

        int peopleAhead = countWaitingAhead(token);

        return withGeoFields(TokenDto.builder()
                .id(token.getId()).name(token.getName()).phone(token.getPhone()).status(token.getStatus())
                .sessionStep(token.getSessionStep()).position(peopleAhead + 1).peopleAhead(peopleAhead)
                .currentServing(queueData.currentServing())
                .isVerified(token.getIsVerified()).verifiedAt(token.getVerifiedAt())
                .build(), token);
    }

    public TokenDto getTokenDetails(String idStr) {
        cleanExpiredTokens();

        int id = Integer.parseInt(idStr);
        TokenDto token = getRaw(id);
        if (token == null) {
            return null;
        }
        QueueData queueData = getQueue(token.getHospitalId(), token.getCategory());

        if (!"waiting".equals(token.getStatus())) {
            return withGeoFields(TokenDto.builder()
                    .id(token.getId()).name(token.getName()).phone(token.getPhone()).status(token.getStatus())
                    .sessionStep(token.getSessionStep()).position(0).peopleAhead(0)
                    .currentServing(queueData.currentServing())
                    .isVerified(token.getIsVerified()).verifiedAt(token.getVerifiedAt())
                    .missedAt(token.getMissedAt()).rejectedAt(token.getRejectedAt())
                    .build(), token);
        }

        int peopleAhead = countWaitingAhead(token);

        return withGeoFields(TokenDto.builder()
                .id(token.getId()).name(token.getName()).phone(token.getPhone()).status(token.getStatus())
                .sessionStep(token.getSessionStep()).position(peopleAhead + 1).peopleAhead(peopleAhead)
                .currentServing(queueData.currentServing())
                .isVerified(token.getIsVerified()).verifiedAt(token.getVerifiedAt())
                .build(), token);
    }

    /** Copies the geo/priority fields from a freshly-read raw row onto a purpose-built response DTO. */
    private TokenDto withGeoFields(TokenDto target, TokenDto raw) {
        target.setDailyNumber(raw.getDailyNumber());
        target.setHospitalId(raw.getHospitalId());
        if (raw.getHospitalId() != null) {
            HospitalDto h = hospitalService.getById(raw.getHospitalId());
            if (h != null) {
                target.setHospitalName(h.getName());
            }
        }
        target.setCategory(raw.getCategory());
        target.setGender(raw.getGender());
        target.setAge(raw.getAge());
        target.setPatientDigipin(raw.getPatientDigipin());
        target.setDistanceKm(raw.getDistanceKm());
        target.setTravelMinutes(raw.getTravelMinutes());
        target.setTreatmentRemainingMinutes(raw.getTreatmentRemainingMinutes());
        target.setNotifiedReadyAt(raw.getNotifiedReadyAt());
        target.setAnomalyControlUntil(raw.getAnomalyControlUntil());
        target.setPriorityRank(raw.getPriorityRank());
        target.setCounterId(raw.getCounterId());
        return target;
    }

    /** Plain, unenriched row read by id -- no position/geo computation, just what's on the row. */
    private TokenDto getRaw(int id) {
        List<TokenDto> rows = jdbc.query("SELECT * FROM tokens WHERE id = :id", Map.of("id", id), TOKEN_ROW_MAPPER);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private int countWaitingAhead(TokenDto token) {
        Map<String, Object> params = new HashMap<>();
        params.put("sortKey", token.getPriorityRank() != null ? token.getPriorityRank() : token.getId());
        params.put("hospitalId", token.getHospitalId());
        params.put("category", token.getCategory());
        Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*)::int FROM tokens WHERE status = 'waiting' AND COALESCE(priority_rank, id) < :sortKey
                  AND hospital_id IS NOT DISTINCT FROM :hospitalId AND category IS NOT DISTINCT FROM :category
                """,
                params, Integer.class);
        return count == null ? 0 : count;
    }

    public TokenDto getActiveToken(String phone) {
        cleanExpiredTokens();

        String sql = """
                SELECT * FROM tokens
                WHERE (phone = :phone OR phone = '+' || :phone OR phone = REPLACE(:phone, '+', '') OR phone LIKE '%' || :phone)
                  AND status IN ('waiting', 'serving', 'registering_name')
                LIMIT 1
                """;
        List<TokenDto> rows = jdbc.query(sql, Map.of("phone", phone), TOKEN_ROW_MAPPER);
        return rows.isEmpty() ? null : rows.get(0);
    }

    // -----------------------------------------------------------------
    // Booking flow: name -> gender -> age -> category -> location ->
    // search/select hospital -> confirm. A returning phone that already has
    // a known identity (see findKnownIdentity) skips straight from the draft
    // token to "awaiting_category".
    // -----------------------------------------------------------------

    public record KnownIdentity(String name, Integer age, String gender) {
    }

    /**
     * Best-known (name, age, gender) for this phone from either a past
     * completed visit (token_history) or a past registration that got at
     * least that far (tokens, excluding the placeholder "Patient" default
     * and the just-created draft, which never has age/gender yet) --
     * whichever is most recent. Null if this phone has never given all three
     * before.
     */
    private KnownIdentity findKnownIdentity(String phone) {
        String sql = """
                SELECT name, age, gender FROM (
                    SELECT name, age, gender, completed_at AS ts FROM token_history WHERE phone = :phone
                    UNION ALL
                    SELECT name, age, gender, created_at AS ts FROM tokens
                    WHERE phone = :phone AND name <> 'Patient' AND age IS NOT NULL AND gender IS NOT NULL
                ) known
                WHERE name IS NOT NULL AND age IS NOT NULL AND gender IS NOT NULL
                ORDER BY ts DESC NULLS LAST
                LIMIT 1
                """;
        List<KnownIdentity> rows = jdbc.query(sql, Map.of("phone", phone),
                (rs, i) -> new KnownIdentity(rs.getString("name"), (Integer) rs.getObject("age"), rs.getString("gender")));
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * Opens (or returns the existing) draft registration row for this phone.
     * A phone this system already knows (name/age/gender from a past visit
     * or attempt) is pre-filled and jumped straight to "awaiting_category" --
     * only a genuinely new phone is asked for name/gender/age from scratch.
     */
    public TokenDto createRegisteringToken(String phone) {
        TokenDto active = getActiveToken(phone);
        if (active != null) {
            return active;
        }
        String sql = """
                INSERT INTO tokens (name, phone, status, session_step)
                VALUES ('Patient', :phone, 'registering_name', 'awaiting_name')
                RETURNING *
                """;
        List<TokenDto> rows = jdbc.query(sql, Map.of("phone", phone), TOKEN_ROW_MAPPER);
        if (rows.isEmpty()) {
            return null;
        }
        TokenDto draft = rows.get(0);

        KnownIdentity known = findKnownIdentity(phone);
        if (known == null) {
            return draft;
        }
        List<TokenDto> updated = jdbc.query(
                "UPDATE tokens SET name = :name, age = :age, gender = :gender, session_step = 'awaiting_category' WHERE id = :id RETURNING *",
                Map.of("name", known.name(), "age", known.age(), "gender", known.gender(), "id", draft.getId()),
                TOKEN_ROW_MAPPER);
        return updated.isEmpty() ? draft : updated.get(0);
    }

    /** STEP 1: name captured -> next asks gender. */
    public TokenDto captureName(int tokenId, String name) {
        List<TokenDto> rows = jdbc.query(
                "UPDATE tokens SET name = :name, session_step = 'awaiting_gender' WHERE id = :id RETURNING *",
                Map.of("name", name, "id", tokenId), TOKEN_ROW_MAPPER);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** STEP 2: gender captured -> next asks age. */
    public TokenDto captureGender(int tokenId, String gender) {
        List<TokenDto> rows = jdbc.query(
                "UPDATE tokens SET gender = :gender, session_step = 'awaiting_age' WHERE id = :id RETURNING *",
                Map.of("gender", gender, "id", tokenId), TOKEN_ROW_MAPPER);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** STEP 3: age captured -> next asks category (department). Token is not queued yet -- that only happens on confirmBooking. */
    public TokenDto captureAge(int tokenId, int age) {
        List<TokenDto> rows = jdbc.query(
                "UPDATE tokens SET age = :age, session_step = 'awaiting_category' WHERE id = :id RETURNING *",
                Map.of("age", age, "id", tokenId), TOKEN_ROW_MAPPER);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** STEP 4: category captured -> next asks for the patient's location, to search hospitals by. */
    public TokenDto captureCategory(int tokenId, String category) {
        List<TokenDto> rows = jdbc.query(
                "UPDATE tokens SET category = :category, session_step = 'awaiting_location' WHERE id = :id RETURNING *",
                Map.of("category", category, "id", tokenId), TOKEN_ROW_MAPPER);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public record HospitalSearchOutcome(TokenDto draft, HospitalService.HospitalSearchPage page) {
    }

    /**
     * STEP 5: location captured -> hospitals offering this token's category,
     * open to its gender, ranked nearest-first, first page. Empty results
     * bounce the draft back to "awaiting_category" instead of stranding the
     * patient on a dead-end step.
     */
    public HospitalSearchOutcome searchAndOfferHospitals(int tokenId, SetLocationRequest location) {
        HospitalService.LatLon resolved = hospitalService.resolveLocation(location);
        List<TokenDto> rows = jdbc.query(
                """
                UPDATE tokens
                SET patient_digipin = :digipin, patient_lat = :lat, patient_lon = :lon, search_offset = 0
                WHERE id = :id
                RETURNING *
                """,
                Map.of("digipin", resolved.digipin(), "lat", resolved.lat(), "lon", resolved.lon(), "id", tokenId),
                TOKEN_ROW_MAPPER);
        if (rows.isEmpty()) {
            return null;
        }
        TokenDto draft = rows.get(0);

        HospitalService.HospitalSearchPage page = hospitalService.searchHospitals(
                draft.getCategory(), draft.getGender(), resolved.lat(), resolved.lon(), 0, HOSPITAL_PAGE_SIZE);

        if (page.results().isEmpty()) {
            List<TokenDto> reverted = jdbc.query(
                    "UPDATE tokens SET session_step = 'awaiting_category' WHERE id = :id RETURNING *",
                    Map.of("id", tokenId), TOKEN_ROW_MAPPER);
            return new HospitalSearchOutcome(reverted.isEmpty() ? draft : reverted.get(0), page);
        }

        jdbc.update("UPDATE tokens SET search_offset = :offset, session_step = 'awaiting_hospital_selection' WHERE id = :id",
                Map.of("offset", HOSPITAL_PAGE_SIZE, "id", tokenId));
        return new HospitalSearchOutcome(getRaw(tokenId), page);
    }

    /** "Show more" -- next page of the same search, from wherever search_offset last left off. */
    public HospitalSearchOutcome showMoreHospitals(int tokenId) {
        TokenDto draft = getRaw(tokenId);
        if (draft == null || draft.getPatientLat() == null || draft.getPatientLon() == null) {
            return null;
        }
        int offset = draft.getSearchOffset() != null ? draft.getSearchOffset() : 0;
        HospitalService.HospitalSearchPage page = hospitalService.searchHospitals(
                draft.getCategory(), draft.getGender(), draft.getPatientLat(), draft.getPatientLon(), offset, HOSPITAL_PAGE_SIZE);
        jdbc.update("UPDATE tokens SET search_offset = :offset WHERE id = :id",
                Map.of("offset", offset + HOSPITAL_PAGE_SIZE, "id", tokenId));
        return new HospitalSearchOutcome(draft, page);
    }

    /** "Choose Again" (declined the confirmation card) -- clears the tentative pick and re-shows results from the top. */
    public HospitalSearchOutcome restartHospitalSelection(int tokenId) {
        jdbc.update("UPDATE tokens SET search_offset = 0, hospital_id = NULL WHERE id = :id", Map.of("id", tokenId));
        return showMoreHospitals(tokenId);
    }

    /** STEP 6: patient taps a hospital row -> tentatively selected, next asks for a yes/no confirmation. */
    public TokenDto selectHospital(int tokenId, int hospitalId) {
        HospitalDto hospital = hospitalService.getById(hospitalId);
        if (hospital == null) {
            return null;
        }
        List<TokenDto> rows = jdbc.query(
                "UPDATE tokens SET hospital_id = :hospitalId, session_step = 'awaiting_confirmation' WHERE id = :id RETURNING *",
                Map.of("hospitalId", hospitalId, "id", tokenId), TOKEN_ROW_MAPPER);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** STEP 7: patient confirms -> the draft actually joins its (hospital, category) queue. */
    public TokenDto confirmBooking(int tokenId) {
        TokenDto draft = getRaw(tokenId);
        if (draft == null || draft.getHospitalId() == null) {
            throw new IllegalStateException("No hospital selected yet.");
        }
        HospitalDto hospital = hospitalService.getById(draft.getHospitalId());
        if (hospital == null) {
            throw new IllegalStateException("Selected hospital no longer exists.");
        }
        if (hospital.getCloseTime() != null) {
            java.time.LocalTime now = java.time.LocalTime.now();
            java.time.LocalTime closeTime = hospital.getCloseTime();
            java.time.LocalTime cutOffTime = closeTime.minusMinutes(30);
            if (!now.isBefore(cutOffTime) && now.isBefore(closeTime.plusHours(2))) {
                throw new IllegalStateException("Online token booking for today is closed because " 
                    + hospital.getName() + " OPD closes at " + closeTime + " (within 30 minutes). Please visit the reception counter directly or book for tomorrow.");
            }
        }
        hospitalDepartmentService.ensure(hospital.getId(), draft.getCategory());

        jdbc.update(
                """
                UPDATE tokens SET status = 'waiting', session_step = 'menu', created_at = NOW(),
                    daily_number = :dailyNumber
                WHERE id = :id
                """,
                Map.of("id", tokenId, "dailyNumber", nextDailyNumber(hospital.getId(), draft.getCategory())));

        if (draft.getPatientLat() != null && draft.getPatientLon() != null) {
            try {
                applyPatientLocation(tokenId, new SetLocationRequest(draft.getPatientDigipin(), draft.getPatientLat(), draft.getPatientLon()), hospital);
            } catch (Exception e) {
                log.error("Could not apply patient location on booking confirm for token {}: {}", tokenId, e.getMessage());
            }
        }
        return getTokenDetails(String.valueOf(tokenId));
    }

    // -----------------------------------------------------------------
    // Direct/API booking (not via the WhatsApp search flow) -- books into
    // whichever hospital the patient picked (see FindHospital.jsx / the
    // "nearby" search), falling back to this deployment's single operating
    // hospital only when none was given, for callers that never offer a
    // hospital picker (e.g. a single-hospital deployment's own booking form).
    // Still requires a category since every token belongs to a
    // (hospital, category) queue now.
    // -----------------------------------------------------------------

    /** age/gender/location are all optional -- when location is given (current GPS or manually entered), the distance-based notify window is computed immediately. hospitalId is optional -- omit it to book into this deployment's single operating hospital. */
    public CreateTokenResult createToken(String name, Integer age, String gender, String category, String phone, SetLocationRequest location, Integer hospitalId) {
        cleanExpiredTokens();

        if (appProperties.isOtpRequiredForRegistration() && !otpService.isPhoneVerifiedRecently(phone)) {
            throw new IllegalStateException("Please verify your phone number with the OTP sent via SMS before registering.");
        }

        String canonicalCategory = MedicalCategory.canonicalize(category);
        if (canonicalCategory == null) {
            throw new IllegalArgumentException("Unknown category: \"" + category + "\". See GET /api/hospitals/categories for the valid list.");
        }

        TokenDto active = getActiveToken(phone);
        if (active != null) {
            return new CreateTokenResult(true, getTokenDetails(String.valueOf(active.getId())));
        }

        HospitalDto hospital;
        if (hospitalId != null) {
            hospital = hospitalService.getById(hospitalId);
            if (hospital == null) {
                throw new IllegalArgumentException("Selected hospital not found.");
            }
        } else {
            hospital = hospitalService.getOperatingHospital();
        }
        if (hospital != null && hospital.getCloseTime() != null) {
            java.time.LocalTime now = java.time.LocalTime.now();
            java.time.LocalTime closeTime = hospital.getCloseTime();
            java.time.LocalTime cutOffTime = closeTime.minusMinutes(30);
            if (!now.isBefore(cutOffTime) && now.isBefore(closeTime.plusHours(2))) {
                throw new IllegalStateException("Online token booking for today is closed because OPD closes at " 
                    + closeTime + " (within 30 minutes). Please visit the reception counter directly or book for tomorrow.");
            }
        }

        String defaultName = (name == null || name.isBlank()) ? "Patient" : name;
        if (hospital != null) {
            hospitalDepartmentService.ensure(hospital.getId(), canonicalCategory);
        }

        Integer resolvedHospitalId = hospital != null ? hospital.getId() : null;
        Map<String, Object> insertParams = new HashMap<>();
        insertParams.put("name", defaultName);
        insertParams.put("age", age);
        insertParams.put("gender", gender == null ? null : gender.toLowerCase());
        insertParams.put("category", canonicalCategory);
        insertParams.put("phone", phone);
        insertParams.put("hospitalId", resolvedHospitalId);
        insertParams.put("dailyNumber", nextDailyNumber(resolvedHospitalId, canonicalCategory));

        Integer newId = jdbc.queryForObject(
                """
                INSERT INTO tokens (name, age, gender, category, phone, status, session_step, hospital_id, daily_number)
                VALUES (:name, :age, :gender, :category, :phone, 'waiting', 'menu', :hospitalId, :dailyNumber)
                RETURNING id
                """,
                insertParams, Integer.class);

        if (location != null && hospital != null) {
            try {
                applyPatientLocation(newId, location, hospital);
            } catch (Exception e) {
                log.error("Could not apply patient location for token {}: {}", newId, e.getMessage());
            }
        }

        return new CreateTokenResult(false, getTokenDetails(String.valueOf(newId)));
    }

    /**
     * The patient-facing "Token #N" for a fresh (hospital, category) booking made
     * today -- 1, 2, 3, ... independently for every hospital's every department,
     * unlike the raw `id` column (a single sequence shared across every hospital
     * and department in the whole system, which is what patients used to be
     * shown -- confusing when e.g. a patient is 1st in line but sees "Token #13"
     * because 12 other tokens already exist elsewhere today). Not a DB sequence:
     * just "one more than today's highest daily_number in this (hospital,
     * category)" -- good enough for a display label under normal booking
     * volume/concurrency; a true collision just means two patients momentarily
     * share a display number, which self-corrects on the next booking.
     */
    private Integer nextDailyNumber(Integer hospitalId, String category) {
        Map<String, Object> params = new HashMap<>();
        params.put("hospitalId", hospitalId);
        params.put("category", category);
        Integer max = jdbc.queryForObject(
                """
                SELECT MAX(daily_number) FROM tokens
                WHERE hospital_id IS NOT DISTINCT FROM :hospitalId AND category IS NOT DISTINCT FROM :category
                  AND created_at::date = CURRENT_DATE
                """,
                params, Integer.class);
        return (max == null ? 0 : max) + 1;
    }

    /** Sets/updates a patient's location on an existing token and recomputes distance + notify window from it. */
    public TokenDto updateTokenLocation(int tokenId, SetLocationRequest location) {
        TokenDto token = getRaw(tokenId);
        if (token == null) {
            return null;
        }
        HospitalDto hospital = token.getHospitalId() != null
                ? hospitalService.getById(token.getHospitalId())
                : hospitalService.getOperatingHospital();
        if (hospital == null) {
            throw new IllegalStateException("Hospital location is not configured yet.");
        }
        applyPatientLocation(tokenId, location, hospital);
        return getTokenDetails(String.valueOf(tokenId));
    }

    /**
     * Resolves the patient's location to a real TomTom routing ETA (falling
     * back to the straight-line estimate when TomTom isn't available -- see
     * TomTomRoutingService) and stores it as this token's "reaching time".
     * Clears any in-flight notify/anomaly-control state -- a relocation
     * invalidates whatever plan was computed off the old position -- so
     * runTreatmentTimingTick treats this token as freshly eligible again.
     */
    private void applyPatientLocation(int tokenId, SetLocationRequest location, HospitalDto hospital) {
        HospitalService.LatLon resolved = hospitalService.resolveLocation(location);
        TomTomRoutingService.RouteEstimate route = tomTomRoutingService.estimate(
                hospital.getLatitude(), hospital.getLongitude(), resolved.lat(), resolved.lon());

        jdbc.update(
                """
                UPDATE tokens
                SET patient_digipin = :digipin, patient_lat = :lat, patient_lon = :lon,
                    distance_km = :distanceKm, travel_minutes = :travelMinutes,
                    treatment_remaining_minutes = NULL, notified_ready_at = NULL, anomaly_control_until = NULL
                WHERE id = :id
                """,
                Map.of("digipin", resolved.digipin(), "lat", resolved.lat(), "lon", resolved.lon(),
                        "distanceKm", route.distanceKm(), "travelMinutes", route.travelMinutes(), "id", tokenId));
    }

    /**
     * Can this patient realistically reach the hospital before OPD closes,
     * given their current distance? Pure read -- callers decide what to do
     * with a "no" (e.g. show "Continue anyway / Choose another hospital").
     */
    public GeoDistanceService.ArrivalFeasibility checkClosingTimeFeasibility(double lat, double lon) {
        HospitalDto hospital = hospitalService.getOperatingHospital();
        if (hospital == null) {
            throw new IllegalStateException("Hospital location is not configured yet.");
        }
        double distanceKm = geoDistanceService.distanceKm(hospital.getLatitude(), hospital.getLongitude(), lat, lon);
        double travelMinutes = geoDistanceService.estimatedTravelMinutes(distanceKm);

        java.time.LocalTime now = java.time.LocalTime.now();
        long minutesUntilClose = java.time.Duration.between(now, hospital.getCloseTime()).toMinutes();
        return geoDistanceService.checkClosingTime(distanceKm, travelMinutes, minutesUntilClose);
    }

    // -----------------------------------------------------------------
    // Treatment-timing: real routing ETA ("reaching time") vs. how many
    // minutes of queue work are still ahead of the patient ("treatment
    // remaining time"), driving the "go now" WhatsApp + voice-call trigger
    // and the anomaly-control grace window. Polled by
    // service.TreatmentTimingScheduler on a fixed interval (unlike the old
    // straight-line system, this can't rely on "runs on every queue read" --
    // a notify/call has to fire on a wall-clock deadline even with nobody
    // polling the API right now).
    // -----------------------------------------------------------------

    /** One scheduler tick: fire any due "go now" triggers, then resolve any expired anomaly-control grace windows. */
    public void runTreatmentTimingTick() {
        try {
            evaluateNotifyTriggers();
        } catch (Exception e) {
            log.error("Error evaluating treatment-timing notify triggers: {}", e.getMessage());
        }
        try {
            evaluateAnomalyExpiry();
        } catch (Exception e) {
            log.error("Error evaluating anomaly-control expiry: {}", e.getMessage());
        }
    }

    /**
     * Every waiting, not-yet-notified, not-yet-arrived token with a known
     * travel ETA: recompute how many minutes of queue work are still ahead
     * of it (persisted for display either way), and the moment that's no
     * longer comfortably longer than the travel ETA (+ the configured
     * buffer), fire the WhatsApp notification + voice call together and
     * open its anomaly-control grace window.
     */
    private void evaluateNotifyTriggers() {
        List<Map<String, Object>> candidates = jdbc.queryForList(
                """
                SELECT id FROM tokens
                WHERE status = 'waiting' AND travel_minutes IS NOT NULL AND notified_ready_at IS NULL
                  AND is_verified IS NOT TRUE
                """, Collections.emptyMap());

        for (Map<String, Object> row : candidates) {
            TokenDto token = getRaw((Integer) row.get("id"));
            if (token == null || token.getHospitalId() == null || token.getCategory() == null || token.getTravelMinutes() == null) {
                continue;
            }
            HospitalDto hospital = hospitalService.getById(token.getHospitalId());
            if (hospital == null) {
                continue;
            }

            double treatmentRemaining = computeTreatmentRemainingMinutes(token, hospital);
            jdbc.update("UPDATE tokens SET treatment_remaining_minutes = :v WHERE id = :id",
                    Map.of("v", treatmentRemaining, "id", token.getId()));

            double travelMinutes = token.getTravelMinutes();
            double buffer = appProperties.getNotifyBufferMinutes();
            if (treatmentRemaining <= travelMinutes + buffer) {
                fireHeadToHospitalTrigger(token, hospital, travelMinutes, treatmentRemaining);
            }
        }
    }

    /**
     * R = ((Ta >= 3 ? Ta - 3 : 0) * minimum-time-to-treat + 2) / active-counters,
     * for this token's own (hospital, category) department. Ta is the count
     * of *genuinely* waiting tokens ahead -- see countGenuinelyAheadForEta:
     * a token that's unverified but still inside its anomaly-control grace
     * window doesn't hold up anyone behind it for this estimate, since it's
     * effectively set aside (not competing for a counter right now) until
     * its grace ends and it's either pushed back or marked missed.
     */
    private double computeTreatmentRemainingMinutes(TokenDto token, HospitalDto hospital) {
        int ta = countGenuinelyAheadForEta(token);
        int activeCounters = hospitalDepartmentService.activeCounters(token.getHospitalId(), token.getCategory());
        Integer minServiceMinutes = hospital.getMinServiceMinutes() != null
                ? hospital.getMinServiceMinutes() : hospital.getAvgServiceMinutes();
        double minimumTime = minServiceMinutes != null ? minServiceMinutes : appProperties.getAvgServiceMinutes();

        int aheadBeyondHeadstart = ta >= ETA_WAITING_HEADSTART_TOKENS ? (ta - ETA_WAITING_HEADSTART_TOKENS) : 0;
        return (aheadBeyondHeadstart * minimumTime + ETA_FIXED_BUFFER_MINUTES) / Math.max(1, activeCounters);
    }

    /**
     * Ta for the R estimate above only -- waiting tokens strictly ahead of
     * this one, excluding any currently parked in their anomaly-control
     * grace window (see class docs / handleNoShowOrMiss). Deliberately a
     * separate query from countWaitingAhead(): that one still needs to count
     * every waiting token, graced or not, for patient-facing "your position"
     * displays and for the missed-vs-push-back boundary in
     * handleNoShowOrMiss -- only the ETA estimate treats a graced token as
     * temporarily out of the way.
     */
    private int countGenuinelyAheadForEta(TokenDto token) {
        Map<String, Object> params = new HashMap<>();
        params.put("sortKey", token.getPriorityRank() != null ? token.getPriorityRank() : token.getId());
        params.put("hospitalId", token.getHospitalId());
        params.put("category", token.getCategory());
        Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*)::int FROM tokens WHERE status = 'waiting' AND COALESCE(priority_rank, id) < :sortKey
                  AND hospital_id IS NOT DISTINCT FROM :hospitalId AND category IS NOT DISTINCT FROM :category
                  AND NOT (is_verified IS NOT TRUE AND anomaly_control_until IS NOT NULL AND anomaly_control_until > NOW())
                """,
                params, Integer.class);
        return count == null ? 0 : count;
    }

    /**
     * Fires once per notify cycle: marks the token notified, opens an
     * anomaly-control grace window sized to whatever slack the patient's
     * travel time buys them beyond their queue wait (0 if none -- the
     * "reaching time < remaining time" case falls straight through to the
     * exponential push-back almost immediately, per the product spec), and
     * sends the localized WhatsApp message + Twilio voice call together.
     */
    private void fireHeadToHospitalTrigger(TokenDto token, HospitalDto hospital, double travelMinutes, double treatmentRemaining) {
        double slackMinutes = Math.max(0, travelMinutes - treatmentRemaining);
        int updated = jdbc.update(
                "UPDATE tokens SET notified_ready_at = NOW(), anomaly_control_until = NOW() + (:slack || ' minutes')::INTERVAL "
                        + "WHERE id = :id AND notified_ready_at IS NULL",
                Map.of("slack", String.valueOf(slackMinutes), "id", token.getId()));
        if (updated == 0) {
            return; // lost a race with another tick/instance -- already notified
        }

        Lang lang = resolveLang(token.getPhone());
        String message = botMessages.headingToHospitalNotification(
                lang, token.getName(), token.displayNumber(), token.getCategory(), hospital.getName());
        whatsAppService.sendWhatsAppMessage(token.getPhone(), message);
        twilioStudioCallService.triggerHeadToHospitalCall(token.getPhone(), message, lang);
    }

    /** This phone's chosen WhatsApp bot language (see WaSessionService), defaulting to English if it's never messaged the bot. */
    private Lang resolveLang(String phone) {
        WaSessionService.WaSession session = waSessionService.get(phone);
        return (session != null && session.language() != null) ? session.language() : Lang.EN;
    }

    /**
     * Every waiting, not-yet-arrived token whose anomaly-control grace
     * window has elapsed: push it back exponentially (same 1, 2, 4, 8, 16,
     * ... rule as an admin's manual "not come yet"), unless it's already
     * sitting at the very back of its department's queue with nowhere left
     * to push back to -- at that point it's genuinely missed.
     */
    private void evaluateAnomalyExpiry() {
        List<Map<String, Object>> due = jdbc.queryForList(
                """
                SELECT id FROM tokens
                WHERE status = 'waiting' AND anomaly_control_until IS NOT NULL AND anomaly_control_until <= NOW()
                  AND is_verified IS NOT TRUE
                """, Collections.emptyMap());

        for (Map<String, Object> row : due) {
            TokenDto token = getRaw((Integer) row.get("id"));
            if (token != null && "waiting".equals(token.getStatus())) {
                handleNoShowOrMiss(token);
            }
        }
    }

    /**
     * Shared by evaluateAnomalyExpiry() above and claimNextEligibleWaitingToken's
     * "still not verified when their turn comes up" branch: push the token
     * back exponentially if there's still room to (reuses pushBackNoShow, so
     * the same no_show_count keeps growing 1, 2, 4, 8, 16, ... regardless of
     * which of the two callers triggered it); otherwise it's already at the
     * back of its own department's queue with nowhere further to go, so it's
     * marked missed instead.
     */
    private void handleNoShowOrMiss(TokenDto token) {
        int queueSize = otherWaitingRanksInOrder(token).size() + 1;
        int currentPosition = countWaitingAhead(token) + 1;
        if (currentPosition >= queueSize) {
            updateTokenStatus(String.valueOf(token.getId()), "missed");
        } else {
            pushBackNoShow(token.getId());
        }
    }

    private void sendTurnNotification(String phone, int displayNumber) {
        whatsAppService.sendWhatsAppMessage(phone,
                "🎉 It's your turn now! Please come to the counter for Token #" + displayNumber + ".");
    }

    private void sendNextInLineNotification(String phone, int displayNumber) {
        whatsAppService.sendWhatsAppMessage(phone,
                "🔔 You are next in line for Token #" + displayNumber + "! There is only 1 person ahead of you. Please be ready.");
    }

    public UpdateStatusResult updateTokenStatus(String idStr, String status) {
        int tokenId = Integer.parseInt(idStr);

        if ("serving".equals(status)) {
            TokenDto target = getRaw(tokenId);
            if (target == null) {
                return null;
            }

            Map<String, Object> scopeParams = new HashMap<>();
            scopeParams.put("id", tokenId);
            scopeParams.put("hospitalId", target.getHospitalId());
            scopeParams.put("category", target.getCategory());
            jdbc.update(
                    """
                    UPDATE tokens SET status = 'completed', completed_at = NOW() WHERE status = 'serving' AND id != :id
                      AND hospital_id IS NOT DISTINCT FROM :hospitalId AND category IS NOT DISTINCT FROM :category
                    """,
                    scopeParams);

            List<TokenDto> rows = jdbc.query(
                    "UPDATE tokens SET status = 'serving', served_at = NOW(), no_show_count = 0 WHERE id = :id RETURNING *",
                    Map.of("id", tokenId), TOKEN_ROW_MAPPER);
            if (rows.isEmpty()) {
                return null;
            }
            TokenDto token = rows.get(0);
            sendTurnNotification(token.getPhone(), token.displayNumber());

            TokenDto view = TokenDto.builder()
                    .id(token.getId()).phone(token.getPhone()).name(token.getName()).status(token.getStatus())
                    .sessionStep(token.getSessionStep()).createdAt(token.getCreatedAt()).servedAt(token.getServedAt())
                    .build();
            return new UpdateStatusResult(view, null);
        }

        if ("completed".equals(status) || "missed".equals(status)) {
            String timeColumn = "completed".equals(status) ? "completed_at" : "missed_at";
            String updateSql = "UPDATE tokens SET status = :status, " + timeColumn + " = NOW() WHERE id = :id RETURNING *";
            List<TokenDto> rows = jdbc.query(updateSql, Map.of("status", status, "id", tokenId), TOKEN_ROW_MAPPER);
            if (rows.isEmpty()) {
                return null;
            }
            TokenDto updatedToken = rows.get(0);

            if ("completed".equals(status)) {
                archiveToHistory(updatedToken);
                whatsAppService.sendWhatsAppMessage(updatedToken.getPhone(),
                        "✅ Token #" + updatedToken.displayNumber() + " has been served. Thank you for visiting "
                                + appProperties.getClinicName() + "! 🙏");
            } else {
                whatsAppService.sendWhatsAppMessage(updatedToken.getPhone(),
                        "⚠️ You missed your turn for Token #" + updatedToken.displayNumber()
                                + ".\n\n📌 Please send \"Hi\" or \"Hello\" again to generate a new token.");
            }

            Integer nextServingId = advanceToNextEligibleWaiting(updatedToken.getHospitalId(), updatedToken.getCategory());

            TokenDto view = TokenDto.builder()
                    .id(updatedToken.getId()).phone(updatedToken.getPhone()).name(updatedToken.getName())
                    .status(updatedToken.getStatus()).sessionStep(updatedToken.getSessionStep())
                    .createdAt(updatedToken.getCreatedAt()).servedAt(updatedToken.getServedAt())
                    .completedAt(updatedToken.getCompletedAt()).missedAt(updatedToken.getMissedAt())
                    .build();
            return new UpdateStatusResult(view, nextServingId);
        }

        // Fallback branch: only remaining valid status is 'waiting' (route validation
        // restricts status to waiting/serving/completed/missed).
        List<TokenDto> rows = jdbc.query(
                "UPDATE tokens SET status = :status, served_at = NULL, completed_at = NULL, missed_at = NULL WHERE id = :id RETURNING *",
                Map.of("status", status, "id", tokenId), TOKEN_ROW_MAPPER);
        if (rows.isEmpty()) {
            return null;
        }
        TokenDto token = rows.get(0);
        TokenDto view = TokenDto.builder()
                .id(token.getId()).phone(token.getPhone()).name(token.getName()).status(token.getStatus())
                .sessionStep(token.getSessionStep()).createdAt(token.getCreatedAt())
                .build();
        return new UpdateStatusResult(view, null);
    }

    /**
     * Copies a just-completed token into the permanent token_history ledger.
     * Doesn't touch/delete the "tokens" row -- today's live stats/queue view
     * (getQueue()) still count it exactly as before; this just also gives it
     * a durable, per-phone-searchable home (see getPatientHistory) that
     * outlives it. The same phone number was already free to book a new
     * token -- for a different patient, different name/age -- the instant
     * this one left 'waiting'/'serving'/'registering_name'; this is purely
     * the audit trail for that.
     */
    private void archiveToHistory(TokenDto token) {
        // Map.of() rejects null values outright, and age/gender/category/hospitalId/counterId/
        // servedAt can legitimately be null -- a plain HashMap tolerates them.
        Map<String, Object> params = new HashMap<>();
        params.put("tokenId", token.getId());
        params.put("phone", token.getPhone());
        params.put("name", token.getName());
        params.put("age", token.getAge());
        params.put("gender", token.getGender());
        params.put("category", token.getCategory());
        params.put("hospitalId", token.getHospitalId());
        params.put("counterId", token.getCounterId());
        params.put("createdAt", token.getCreatedAt());
        params.put("servedAt", token.getServedAt());
        params.put("completedAt", token.getCompletedAt() != null ? token.getCompletedAt() : java.time.LocalDateTime.now());

        jdbc.update(
                """
                INSERT INTO token_history (token_id, phone, name, age, gender, category, hospital_id, counter_id, created_at, served_at, completed_at)
                VALUES (:tokenId, :phone, :name, :age, :gender, :category, :hospitalId, :counterId, :createdAt, :servedAt, :completedAt)
                """,
                params);
    }

    /** Every past completed visit under this phone number, most recent first -- across however many different patients have used it. */
    public List<TokenHistoryDto> getPatientHistory(String phone) {
        return jdbc.query(
                "SELECT * FROM token_history WHERE phone = :phone ORDER BY completed_at DESC NULLS LAST, id DESC",
                Map.of("phone", phone), TOKEN_HISTORY_ROW_MAPPER);
    }

    /**
     * Picks the next waiting token in this (hospitalId, category) department
     * to serve, in queue order, auto-skipping (marking 'missed', no manual
     * intervention needed) any token that was already sent its
     * distance-based "get ready" ping but never checked in (barcode-scanned
     * / is_verified) by the time its turn came up -- the "Missed Priority
     * Window" rule. Also pings the following token as "next in line" once a
     * token is actually put into service.
     */
    private Integer advanceToNextEligibleWaiting(Integer hospitalId, String category) {
        TokenDto claimed = claimNextEligibleWaitingToken(hospitalId, category);
        if (claimed == null) {
            return null;
        }
        sendTurnNotification(claimed.getPhone(), claimed.displayNumber());

        Map<String, Object> params = new HashMap<>();
        params.put("hospitalId", hospitalId);
        params.put("category", category);
        List<Map<String, Object>> upNext = jdbc.queryForList(
                """
                SELECT id, phone, daily_number FROM tokens WHERE status = 'waiting'
                  AND hospital_id IS NOT DISTINCT FROM :hospitalId AND category IS NOT DISTINCT FROM :category
                ORDER BY %s LIMIT 1
                """.formatted(QUEUE_ORDER),
                params);
        if (!upNext.isEmpty()) {
            Integer dailyNumber = (Integer) upNext.get(0).get("daily_number");
            sendNextInLineNotification((String) upNext.get(0).get("phone"), dailyNumber != null ? dailyNumber : 0);
        }
        return claimed.getId();
    }

    /**
     * Atomically claims the front-most waiting token in this
     * (hospitalId, category) department and flips it to 'serving'. A token
     * that's been notified but still isn't checked in (is_verified) is
     * skipped -- someone not physically present can't be served -- but only
     * *penalized* (pushed back exponentially, or marked missed if there's
     * nowhere left to push back to, via handleNoShowOrMiss) once its
     * anomaly-control grace window has actually elapsed; while they're still
     * within their travel-time grace they're left exactly where they are and
     * simply tried again next time a counter frees up. Shared by the
     * single-counter flow above and by CounterAssignmentService for the
     * multi-counter package -- neither sends the "your turn" notification
     * here, since the multi-counter caller needs to mention which counter to
     * go to.
     */
    public TokenDto claimNextEligibleWaitingToken(Integer hospitalId, String category) {
        int guard = 0;
        while (guard++ < 200) {
            Map<String, Object> scopeParams = new HashMap<>();
            scopeParams.put("hospitalId", hospitalId);
            scopeParams.put("category", category);
            List<Map<String, Object>> candidates = jdbc.queryForList(
                    """
                    SELECT id, is_verified, notified_ready_at, anomaly_control_until FROM tokens WHERE status = 'waiting'
                      AND hospital_id IS NOT DISTINCT FROM :hospitalId AND category IS NOT DISTINCT FROM :category
                    ORDER BY %s LIMIT 1
                    """.formatted(QUEUE_ORDER),
                    scopeParams);
            if (candidates.isEmpty()) {
                return null;
            }
            Map<String, Object> candidate = candidates.get(0);
            int id = (Integer) candidate.get("id");
            boolean verified = Boolean.TRUE.equals(candidate.get("is_verified"));
            boolean wasNotified = candidate.get("notified_ready_at") != null;
            java.time.LocalDateTime anomalyUntil = (java.time.LocalDateTime) candidate.get("anomaly_control_until");

            if (wasNotified && !verified) {
                boolean stillWithinGrace = anomalyUntil != null && anomalyUntil.isAfter(java.time.LocalDateTime.now());
                if (stillWithinGrace) {
                    // The one desk this method serves has nothing else it can do --
                    // the front of the line is still legitimately allowed time to
                    // arrive, so this claim attempt simply fails; the caller (or the
                    // next admin/scheduler trigger) tries again later. Returning here
                    // instead of looping is a pure efficiency fix -- looping would
                    // just re-select this exact same unchanged row up to `guard`
                    // times for the same outcome.
                    return null;
                }
                TokenDto fullToken = getRaw(id);
                if (fullToken != null) {
                    handleNoShowOrMiss(fullToken);
                }
                continue; // that push-back/miss changed the front of the line -- re-check it
            }

            List<TokenDto> claimedRows = jdbc.query(
                    "UPDATE tokens SET status = 'serving', served_at = NOW(), no_show_count = 0 WHERE id = :id AND status = 'waiting' RETURNING *",
                    Map.of("id", id), TOKEN_ROW_MAPPER);
            if (claimedRows.isEmpty()) {
                continue; // lost a race (e.g. concurrent admin action) -- retry
            }
            return claimedRows.get(0);
        }
        log.error("claimNextEligibleWaitingToken() hit its safety guard without resolving -- check for a stuck loop.");
        return null;
    }

    /**
     * Multi-counter variant of claimNextEligibleWaitingToken(). The
     * single-counter version above is correct to block on a still-graced
     * front-of-line token -- with exactly one desk, there's nothing else it
     * could usefully do. With N counters genuinely running in parallel,
     * though, that same "wait for the front" rule would freeze every counter
     * over one patient's commute, even while other counters are free and
     * other, fully eligible patients are waiting right behind them. This
     * version scans the whole department's waiting list in one query instead
     * of re-querying LIMIT 1, and -- unlike the single-counter version --
     * actually skips PAST a still-graced token to try the next candidate,
     * without ever touching it: it's left exactly where it is, still first
     * in line, simply not eligible to be the answer to *this* particular
     * "which counter's about to free up" question. A token whose grace has
     * actually expired is still resolved (pushed back / marked missed)
     * exactly as the single-counter version does.
     */
    public TokenDto claimNextEligibleWaitingTokenForCounter(Integer hospitalId, String category) {
        int guard = 0;
        while (guard++ < 200) {
            Map<String, Object> scopeParams = new HashMap<>();
            scopeParams.put("hospitalId", hospitalId);
            scopeParams.put("category", category);
            List<Map<String, Object>> candidates = jdbc.queryForList(
                    """
                    SELECT id, is_verified, notified_ready_at, anomaly_control_until FROM tokens WHERE status = 'waiting'
                      AND hospital_id IS NOT DISTINCT FROM :hospitalId AND category IS NOT DISTINCT FROM :category
                    ORDER BY %s
                    """.formatted(QUEUE_ORDER),
                    scopeParams);
            if (candidates.isEmpty()) {
                return null;
            }

            boolean rankingChanged = false;
            for (Map<String, Object> candidate : candidates) {
                int id = (Integer) candidate.get("id");
                boolean verified = Boolean.TRUE.equals(candidate.get("is_verified"));
                boolean wasNotified = candidate.get("notified_ready_at") != null;
                java.time.LocalDateTime anomalyUntil = (java.time.LocalDateTime) candidate.get("anomaly_control_until");

                if (wasNotified && !verified) {
                    boolean stillWithinGrace = anomalyUntil != null && anomalyUntil.isAfter(java.time.LocalDateTime.now());
                    if (stillWithinGrace) {
                        continue; // leave them exactly where they are -- try the next candidate in this same pass instead
                    }
                    TokenDto fullToken = getRaw(id);
                    if (fullToken != null) {
                        handleNoShowOrMiss(fullToken);
                    }
                    rankingChanged = true;
                    break; // ranks shifted underneath this pass -- rescan from a clean ordering
                }

                List<TokenDto> claimedRows = jdbc.query(
                        "UPDATE tokens SET status = 'serving', served_at = NOW(), no_show_count = 0 WHERE id = :id AND status = 'waiting' RETURNING *",
                        Map.of("id", id), TOKEN_ROW_MAPPER);
                if (!claimedRows.isEmpty()) {
                    return claimedRows.get(0);
                }
                // lost a race (e.g. concurrent admin action) -- try the next candidate in this same pass
            }
            if (!rankingChanged) {
                return null; // scanned every waiting token this pass -- nobody's actually eligible right now
            }
        }
        log.error("claimNextEligibleWaitingTokenForCounter() hit its safety guard without resolving -- check for a stuck loop.");
        return null;
    }


    public TokenDto verifyTokenByAdmin(int id) {
        List<TokenDto> rows = jdbc.query(
                "UPDATE tokens SET is_verified = TRUE, verified_at = NOW() WHERE id = :id RETURNING *",
                Map.of("id", id), TOKEN_ROW_MAPPER);
        if (rows.isEmpty()) {
            return null;
        }
        TokenDto token = rows.get(0);
        TokenDto details = getTokenDetails(String.valueOf(token.getId()));

        Integer pos = details != null ? details.getPosition() : null;
        String positionText = (pos != null && pos != 0) ? (pos == 1 ? "1st" : pos + "th") : "In Queue";

        String welcomeMsg = """
                🏥 *WELCOME TO THE HOSPITAL!*

                Hello *%s*,

                Your queue Token *#%d* has been scanned and *VERIFIED* by our reception desk! ✅

                📍 *Status:* Checked-In & Verified
                👥 *Queue Position:* %s

                Thank you for visiting %s. Please take a seat in our waiting room. We will notify you on WhatsApp as soon as your turn arrives! 🙏"""
                .formatted(token.getName(), token.displayNumber(), positionText, appProperties.getClinicName());

        whatsAppService.sendWhatsAppMessage(token.getPhone(), welcomeMsg);

        return details;
    }

    // -----------------------------------------------------------------
    // Anomaly-control: patients already notified/called, still inside their
    // travel-time grace window -- see runTreatmentTimingTick. Read-only;
    // resolution (push-back or missed) happens automatically once the
    // window elapses (evaluateAnomalyExpiry).
    // -----------------------------------------------------------------

    /** Waiting tokens currently inside an active anomaly-control grace window, soonest-to-expire first. hospitalId/category null = no filter. */
    public List<TokenDto> getAnomalyControlQueue(Integer hospitalId, String category) {
        cleanExpiredTokens();
        StringBuilder sql = new StringBuilder(
                "SELECT * FROM tokens WHERE status = 'waiting' AND anomaly_control_until IS NOT NULL AND anomaly_control_until > NOW()");
        Map<String, Object> params = new HashMap<>();
        appendScope(sql, params, hospitalId, category);
        sql.append(" ORDER BY anomaly_control_until ASC");
        return jdbc.query(sql.toString(), params, TOKEN_ROW_MAPPER);
    }

    // -----------------------------------------------------------------
    // Missed queue: admin search, requeue-to-front, reject
    // -----------------------------------------------------------------

    /** Unscoped, hospital-wide view. */
    public List<TokenDto> getMissedQueue() {
        return getMissedQueue(null, null);
    }

    /** Ordered oldest-missed-first, newest-missed-last (a patient who missed later sits at the bottom). hospitalId/category null = no filter. */
    public List<TokenDto> getMissedQueue(Integer hospitalId, String category) {
        cleanExpiredTokens();
        StringBuilder sql = new StringBuilder("SELECT * FROM tokens WHERE status = 'missed'");
        Map<String, Object> params = new HashMap<>();
        appendScope(sql, params, hospitalId, category);
        sql.append(" ORDER BY missed_at ASC NULLS LAST, id ASC");
        return jdbc.query(sql.toString(), params, TOKEN_ROW_MAPPER);
    }

    public List<TokenDto> searchMissedQueue(String query) {
        return searchMissedQueue(query, null, null);
    }

    /** Search the missed queue by token id (exact) or phone number (partial match); hospitalId/category null = no filter. */
    public List<TokenDto> searchMissedQueue(String query, Integer hospitalId, String category) {
        cleanExpiredTokens();
        String q = query == null ? "" : query.trim();
        if (q.isEmpty()) {
            return getMissedQueue(hospitalId, category);
        }

        Map<String, Object> params = new HashMap<>();
        params.put("phoneLike", "%" + q + "%");

        StringBuilder sql = new StringBuilder("SELECT * FROM tokens WHERE status = 'missed' AND (");
        if (q.matches("\\d+")) {
            params.put("idExact", Integer.parseInt(q));
            sql.append("id = :idExact OR phone LIKE :phoneLike");
        } else {
            sql.append("phone LIKE :phoneLike");
        }
        sql.append(")");
        appendScope(sql, params, hospitalId, category);
        sql.append(" ORDER BY missed_at ASC NULLS LAST, id ASC");

        return jdbc.query(sql.toString(), params, TOKEN_ROW_MAPPER);
    }

    /** Puts a missed token back into the waiting queue of its own department, at the very front (position #1). */
    public TokenDto requeueMissedToFront(int id) {
        TokenDto missed = getRaw(id);
        if (missed == null) {
            return null;
        }
        Map<String, Object> scopeParams = new HashMap<>();
        scopeParams.put("hospitalId", missed.getHospitalId());
        scopeParams.put("category", missed.getCategory());
        Double minRank = jdbc.queryForObject(
                """
                SELECT COALESCE(MIN(priority_rank), 0)::float8 FROM tokens WHERE status = 'waiting'
                  AND hospital_id IS NOT DISTINCT FROM :hospitalId AND category IS NOT DISTINCT FROM :category
                """,
                scopeParams, Double.class);
        double newRank = Math.min(minRank == null ? 0.0 : minRank, 0.0) - 1;

        List<TokenDto> rows = jdbc.query(
                """
                UPDATE tokens
                SET status = 'waiting', priority_rank = :rank,
                    missed_at = NULL, served_at = NULL, completed_at = NULL, rejected_at = NULL,
                    notified_ready_at = NULL
                WHERE id = :id AND status = 'missed'
                RETURNING *
                """, Map.of("id", id, "rank", newRank), TOKEN_ROW_MAPPER);

        if (rows.isEmpty()) {
            return null;
        }
        TokenDto token = rows.get(0);
        whatsAppService.sendWhatsAppMessage(token.getPhone(),
                "✅ Good news! Reception has reinstated your Token #" + token.displayNumber()
                        + " and moved it to the FRONT of the queue. Please come to the counter now.");
        return getTokenDetails(String.valueOf(id));
    }

    /** Closes out a missed token permanently -- it will not be auto-cleaned or reappear anywhere active. */
    public TokenDto rejectMissedToken(int id) {
        List<TokenDto> rows = jdbc.query(
                "UPDATE tokens SET status = 'rejected', rejected_at = NOW() WHERE id = :id AND status = 'missed' RETURNING *",
                Map.of("id", id), TOKEN_ROW_MAPPER);
        if (rows.isEmpty()) {
            return null;
        }
        TokenDto token = rows.get(0);
        whatsAppService.sendWhatsAppMessage(token.getPhone(),
                "❌ Your missed Token #" + token.displayNumber() + " has been closed by reception. "
                        + "Please send \"Hi\" to generate a new token if you'd still like to visit.");
        return token;
    }

    // -----------------------------------------------------------------
    // Floating-point priority repositioning + exponential no-show push-back.
    // Both reorder a *waiting* token within its own (hospital, category)
    // queue by giving it a new priority_rank sitting between two existing
    // neighbors' ranks -- fractional/"lexorank"-style indexing, so nobody
    // else's rank needs to change. E.g. ranks 1, 2, 3, 4 -> moving the
    // rank-1 token to sit between the 2nd and 3rd tokens gives it something
    // like 2.5, leaving 2, 2.5, 3, 4 -- everyone else untouched.
    // -----------------------------------------------------------------

    /**
     * Moves a waiting token to the given 1-based position within its own
     * department's waiting queue by computing a new priority_rank between
     * its new neighbors, without renumbering anyone else. targetPosition is
     * clamped to [1, queueSize] -- position 1 is the very front, queueSize
     * is the very back. Service-layer only for now (no HTTP endpoint yet --
     * see prompt.txt).
     */
    public TokenDto movePatientToPosition(int tokenId, int targetPosition) {
        TokenDto token = getRaw(tokenId);
        if (token == null || !"waiting".equals(token.getStatus())) {
            throw new IllegalStateException("Only a waiting token can be repositioned.");
        }

        List<Double> otherRanks = otherWaitingRanksInOrder(token);
        int clamped = Math.max(1, Math.min(targetPosition, otherRanks.size() + 1));
        Double before = clamped >= 2 ? otherRanks.get(clamped - 2) : null;
        Double after = clamped <= otherRanks.size() ? otherRanks.get(clamped - 1) : null;

        double newRank;
        if (before == null && after == null) {
            newRank = 1.0; // only token in the queue
        } else if (before == null) {
            newRank = after - 1.0; // new front of the line
        } else if (after == null) {
            newRank = before + 1.0; // new back of the line
        } else {
            newRank = before + (after - before) / 2.0;
            if (newRank <= before || newRank >= after) {
                // Float precision exhausted between these two neighbors (an
                // extreme number of repeated inserts into the same gap) --
                // spread the whole department's ranks back out to integers
                // and retry once with fresh headroom.
                renumberQueue(token.getHospitalId(), token.getCategory());
                return movePatientToPosition(tokenId, targetPosition);
            }
        }

        // Also drops any multi-counter reservation this token was holding (see
        // CounterAssignmentService#refreshReservations) -- its old position no
        // longer means it's up next for whichever counter had earmarked it.
        jdbc.update("UPDATE tokens SET priority_rank = :rank, reserved_counter_id = NULL WHERE id = :id",
                Map.of("rank", newRank, "id", tokenId));
        return getTokenDetails(String.valueOf(tokenId));
    }

    /**
     * Reception clicks "not come yet" on a called patient who hasn't shown
     * up -- instead of marking them missed outright, push them back within
     * their own waiting queue by an exponentially growing number of
     * positions each time this happens to the *same* token: 1st click skips
     * 1 position, 2nd skips 2, then 4, 8, 16, ... If the queue doesn't have
     * that many waiting patients left (or the skip has grown past what's
     * left), the token goes straight to the back instead. no_show_count
     * resets to 0 the moment the token actually gets served. Also clears
     * notified_ready_at/anomaly_control_until -- pushing a token back changes
     * where it sits relative to the front, so it needs to become eligible for
     * the "go now" trigger (see runTreatmentTimingTick) again at its new
     * position instead of staying marked as already-notified forever.
     */
    public TokenDto pushBackNoShow(int tokenId) {
        TokenDto token = getRaw(tokenId);
        if (token == null || !"waiting".equals(token.getStatus())) {
            throw new IllegalStateException("Only a waiting token can be pushed back.");
        }

        int noShowCount = token.getNoShowCount() == null ? 0 : token.getNoShowCount();
        int skip = noShowCount == 0 ? 1 : (1 << noShowCount); // 1, 2, 4, 8, 16, ...
        int queueSize = otherWaitingRanksInOrder(token).size() + 1; // + this token itself
        int targetPosition = Math.min(skip + 1, queueSize); // not enough patients left -> straight to the back

        jdbc.update(
                "UPDATE tokens SET no_show_count = :count, notified_ready_at = NULL, anomaly_control_until = NULL WHERE id = :id",
                Map.of("count", noShowCount + 1, "id", tokenId));

        TokenDto moved = movePatientToPosition(tokenId, targetPosition);
        whatsAppService.sendWhatsAppMessage(token.getPhone(),
                "⏭️ We called Token #" + token.displayNumber() + " but you weren't ready, so you've been moved back "
                        + skip + " position" + (skip == 1 ? "" : "s") + " in the queue. Please stay nearby.");
        return moved;
    }

    /** Every *other* waiting token in this token's own (hospital, category) department, in queue order. */
    private List<Double> otherWaitingRanksInOrder(TokenDto token) {
        Map<String, Object> scopeParams = new HashMap<>();
        scopeParams.put("hospitalId", token.getHospitalId());
        scopeParams.put("category", token.getCategory());
        scopeParams.put("id", token.getId());
        return jdbc.queryForList(
                """
                SELECT COALESCE(priority_rank, id)::float8 FROM tokens
                WHERE status = 'waiting' AND id != :id
                  AND hospital_id IS NOT DISTINCT FROM :hospitalId AND category IS NOT DISTINCT FROM :category
                ORDER BY COALESCE(priority_rank, id) ASC
                """, scopeParams, Double.class);
    }

    /** Resets a department's waiting queue back to plain integer ranks (1, 2, 3, ...) in its current order. */
    private void renumberQueue(Integer hospitalId, String category) {
        Map<String, Object> scopeParams = new HashMap<>();
        scopeParams.put("hospitalId", hospitalId);
        scopeParams.put("category", category);
        List<Integer> orderedIds = jdbc.queryForList(
                """
                SELECT id FROM tokens WHERE status = 'waiting'
                  AND hospital_id IS NOT DISTINCT FROM :hospitalId AND category IS NOT DISTINCT FROM :category
                ORDER BY COALESCE(priority_rank, id) ASC
                """, scopeParams, Integer.class);
        for (int i = 0; i < orderedIds.size(); i++) {
            jdbc.update("UPDATE tokens SET priority_rank = :rank WHERE id = :id",
                    Map.of("rank", (double) (i + 1), "id", orderedIds.get(i)));
        }
    }
}
