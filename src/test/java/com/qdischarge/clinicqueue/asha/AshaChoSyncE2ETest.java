package com.qdischarge.clinicqueue.asha;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qdischarge.clinicqueue.asha.controller.AshaWorkerController;
import com.qdischarge.clinicqueue.asha.controller.ChoSectorReferralController;
import com.qdischarge.clinicqueue.asha.controller.SyncController;
import com.qdischarge.clinicqueue.asha.dto.AshaWorkerDto;
import com.qdischarge.clinicqueue.asha.dto.FollowUpTaskDto;
import com.qdischarge.clinicqueue.asha.dto.SyncDownloadResponse;
import com.qdischarge.clinicqueue.asha.dto.SyncRecordResult;
import com.qdischarge.clinicqueue.asha.dto.SyncUploadRequest;
import com.qdischarge.clinicqueue.asha.service.*;
import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.security.CurrentUser;
import com.qdischarge.clinicqueue.security.JwtAuthFilter;
import com.qdischarge.clinicqueue.security.JwtService;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StreamUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/**
 * End-to-end on a real PostgreSQL, using the production schema.sql, the
 * real services/controllers and the real JWT filter:
 *
 *   ASHA (OTP token) → household + pregnant member + ANC survey with LMP + high-risk referral
 *   → CHO (OTP token) sees it in their sector → validates it → ASHA download shows APPROVED_CHO.
 *
 * Also covers idempotent re-upload, shared household phones, spoofed-header rejection, sector
 * isolation and proof-based self-registration tokens.
 *
 * Needs a reachable PostgreSQL superuser connection, e.g.
 *   mvn test -Dtest=AshaChoSyncE2ETest -De2e.jdbcUrl="jdbc:postgresql://localhost:54329/postgres?user=postgres"
 * Each run creates (and drops) its own throwaway database. Skipped when e2e.jdbcUrl is not set.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AshaChoSyncE2ETest {

    static final String ASHA = "9876543210";
    static final String CHO = "9876522222";
    static final String OUTSIDE_CHO = "9000000000";

    Connection admin;
    String dbName;
    Connection conn;
    NamedParameterJdbcTemplate jdbc;
    AppProperties props;
    JwtService jwt;
    JwtAuthFilter filter;
    final CurrentUser currentUser = new CurrentUser();

    SyncService syncService;
    ChoReferralService choService;
    WorkerIdentityService identity;
    SyncController syncController;
    ChoSectorReferralController choController;
    AshaWorkerController workerController;

    @BeforeAll
    void startDatabase() throws Exception {
        String url = System.getProperty("e2e.jdbcUrl");
        Assumptions.assumeTrue(url != null && !url.isBlank(), "set -De2e.jdbcUrl to run the PostgreSQL E2E test");
        admin = java.sql.DriverManager.getConnection(url);
        dbName = "aarogya_e2e_" + System.currentTimeMillis();
        try (var st = admin.createStatement()) {
            st.execute("CREATE DATABASE " + dbName);
        }
        conn = java.sql.DriverManager.getConnection(url.replaceFirst("/[A-Za-z0-9_]+(\\?|$)", "/" + dbName + "$1"));
        conn.setAutoCommit(true);
        try (var st = conn.createStatement()) {
            st.execute("CREATE SCHEMA IF NOT EXISTS clinicqueue");
            st.execute("SET search_path TO clinicqueue, public"); // == currentSchema=clinicqueue in prod
        }
        jdbc = new NamedParameterJdbcTemplate(new SingleConnectionDataSource(conn, true));

        // Apply schema.sql exactly like SchemaInitRunner (split on ';', strip '--' comments, skip failures)
        String script = StreamUtils.copyToString(new ClassPathResource("schema.sql").getInputStream(), StandardCharsets.UTF_8);
        for (String stmt : script.split(";")) {
            String cleaned = Arrays.stream(stmt.split("\n"))
                    .map(l -> { int i = l.indexOf("--"); return i >= 0 ? l.substring(0, i) : l; })
                    .collect(Collectors.joining("\n")).trim();
            if (cleaned.isEmpty()) continue;
            try { jdbc.getJdbcTemplate().execute(cleaned); } catch (Exception ignored) { }
        }

        props = new AppProperties();
        props.setJwtSecret("e2e-secret-e2e-secret-e2e-secret-0123456789");
        props.setJwtExpiryMinutes(60);
        props.setWorkerJwtExpiryDays(30);
        props.setChoPhones("+919876522222," + OUTSIDE_CHO);
        jwt = new JwtService(props);
        invokeInit(jwt);
        filter = new JwtAuthFilter(jwt, props);

        ObjectMapper om = new ObjectMapper().findAndRegisterModules();
        syncService = new SyncService(jdbc, om, new SurveyService(jdbc, om));
        choService = new ChoReferralService(jdbc, syncService);
        identity = new WorkerIdentityService(jdbc, props, syncService);
        syncController = new SyncController(syncService, mock(AnmService.class), currentUser);
        choController = new ChoSectorReferralController(choService, currentUser);
        workerController = new AshaWorkerController(new AshaWorkerService(jdbc), currentUser);

        syncService.ensureSyncSchema();
        // Seed: survey templates + the CHO-registered test ASHA (anm_phone = registering CHO)
        for (String code : List.of("PREGNANCY", "CHILD", "DISEASE", "GENERAL")) {
            jdbc.update("INSERT INTO clinicqueue.survey_templates (category_code, category_label, version, is_active, questions) " +
                    "VALUES (:c, :c, 1, TRUE, CAST('[]' AS jsonb))", new MapSqlParameterSource("c", code));
        }
        jdbc.update("INSERT INTO clinicqueue.asha_workers (phone, name, village_name, anm_phone, role, is_active) " +
                "VALUES ('9876543210', 'सुनीता देवी', 'चांदपुर', '+91 98765 22222', 'ASHA', TRUE)", new MapSqlParameterSource());
    }

    private static void invokeInit(JwtService s) throws Exception {
        var m = JwtService.class.getDeclaredMethod("init");
        m.setAccessible(true);
        m.invoke(s);
    }

    @AfterAll
    void stop() throws Exception {
        if (conn != null) conn.close();
        if (admin != null) {
            try (var st = admin.createStatement()) {
                st.execute("DROP DATABASE IF EXISTS " + dbName);
            }
            admin.close();
        }
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
    }

    /** Runs the real JwtAuthFilter for a request carrying these headers. */
    private void as(String bearer, String ashaHeader) throws Exception {
        SecurityContextHolder.clearContext();
        MockHttpServletRequest req = new MockHttpServletRequest();
        if (bearer != null) req.addHeader("Authorization", "Bearer " + bearer);
        if (ashaHeader != null) req.addHeader("X-ASHA-Phone", ashaHeader);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(req));
        filter.doFilter(req, new MockHttpServletResponse(), mock(FilterChain.class));
    }

    /** What /api/auth/otp/verify (purpose=WORKER) issues after a successful OTP. */
    private String otpWorkerToken(String phone) {
        String role = identity.resolveWorkerRole(phone).orElseThrow(() -> new AssertionError("not a worker: " + phone));
        return jwt.generateWorkerToken(com.qdischarge.clinicqueue.util.PhoneNormalizer.normalize(phone), role);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, SyncRecordResult> byOutbox(ResponseEntity<Map<String, Object>> res) {
        return ((List<SyncRecordResult>) res.getBody().get("results")).stream()
                .collect(Collectors.toMap(SyncRecordResult::outboxId, r -> r));
    }

    private int count(String sql) {
        return jdbc.queryForObject(sql, new MapSqlParameterSource(), Integer.class);
    }

    private SyncUploadRequest ashaBatch() {
        SyncUploadRequest req = new SyncUploadRequest();
        req.setFamilies(List.of(
                new HashMap<>(Map.of("outboxId", "ob-fam", "clientUuid", "fam-uuid-1", "headName", "राजेश वर्मा",
                        "villageName", "चांदपुर", "houseNumber", "12", "sequentialNumber", 1, "visitIntervalDays", 7)),
                // shared household phone: two distinct families, same number → both accepted
                new HashMap<>(Map.of("outboxId", "ob-fam2", "clientUuid", "fam-uuid-2", "headName", "मोहन लाल",
                        "houseNumber", "13", "sequentialNumber", 2, "primaryPhone", "+91 91234 56789")),
                new HashMap<>(Map.of("outboxId", "ob-fam3", "clientUuid", "fam-uuid-3", "headName", "श्याम लाल",
                        "houseNumber", "14", "sequentialNumber", 3, "primaryPhone", "+91 91234 56789"))));
        req.setMembers(List.of(new HashMap<>(Map.of("outboxId", "ob-mem", "clientUuid", "mem-uuid-1",
                "familyClientUuid", "fam-uuid-1", "familySequentialNumber", 1, "name", "सुमन वर्मा",
                "relationship", "पत्नी", "age", 24, "gender", "Female", "isPregnant", true))));
        req.setSurveys(List.of(new HashMap<>(Map.of("outboxId", "ob-srv", "offlineId", "srv-uuid-1",
                "familyClientUuid", "fam-uuid-1", "memberClientUuid", "mem-uuid-1", "memberName", "सुमन वर्मा",
                "categoryCode", "PREGNANCY",
                "answers", Map.of("isPregnant", "हाँ", "lmpDate", "12/01/2026", "eddDate", "19/10/2026",
                        "hemoglobin", "6.5", "bp", "150/95")))));
        req.setFollowUps(List.of(new HashMap<>(Map.of("outboxId", "ob-ref", "offlineId", "ref-uuid-1",
                "status", "PENDING", "familyClientUuid", "fam-uuid-1", "memberClientUuid", "mem-uuid-1",
                "memberName", "सुमन वर्मा", "taskType", "ASHA_TO_CHO_REFERRAL",
                "title", "गंभीर एनीमिया (Hb 6.5) • BP 150/95", "description", "उच्च जोखिम गर्भावस्था",
                "dueDate", LocalDate.now().plusDays(2).toString()))));
        return req;
    }

    @Test
    void ashaToChoReferralFlowOnRealPostgres() throws Exception {
        // 1. Identity: roles come from server records
        assertEquals(Optional.of("ASHA"), identity.resolveWorkerRole("+91 98765 43210"));
        assertEquals(Optional.of("CHO"), identity.resolveWorkerRole(CHO));
        String ashaToken = otpWorkerToken(ASHA);
        String choToken = otpWorkerToken(CHO);

        // 2. A spoofed header (no token) is not an identity
        as(null, ASHA);
        assertThrows(ResponseStatusException.class, () -> syncController.upload(ashaBatch()));

        // 3. ASHA uploads household → pregnant member → ANC survey with LMP → high-risk referral
        as(ashaToken, "9999999999"); // mismatched header is ignored; identity = token subject
        var res = byOutbox(syncController.upload(ashaBatch()));
        for (String ob : List.of("ob-fam", "ob-fam2", "ob-fam3", "ob-mem", "ob-srv", "ob-ref")) {
            assertEquals(SyncRecordResult.ACCEPTED, res.get(ob).status(), ob + " → " + res.get(ob));
            assertNotNull(res.get(ob).serverId(), ob);
        }
        int famId = res.get("ob-fam").serverId();
        int memId = res.get("ob-mem").serverId();

        // Bound to the real rows (no "family 1" fallback), owned by the verified ASHA
        assertEquals("fam-uuid-1", jdbc.queryForObject("SELECT client_uuid FROM clinicqueue.family_units WHERE id = :id",
                new MapSqlParameterSource("id", famId), String.class));
        assertEquals("+919876543210", jdbc.queryForObject("SELECT asha_worker_phone FROM clinicqueue.family_units WHERE id = :id",
                new MapSqlParameterSource("id", famId), String.class));
        assertEquals("", jdbc.queryForObject("SELECT primary_phone FROM clinicqueue.family_units WHERE id = :id",
                new MapSqlParameterSource("id", famId), String.class), "phone is optional");
        assertEquals(2, count("SELECT COUNT(*) FROM clinicqueue.family_units WHERE primary_phone = '+91 91234 56789'"), "shared phone");
        Map<String, Object> survey = jdbc.queryForMap("SELECT family_unit_id, family_member_id, answers->>'isPregnant' AS preg " +
                "FROM clinicqueue.survey_responses WHERE offline_id = 'srv-uuid-1'", new MapSqlParameterSource());
        assertEquals(famId, ((Number) survey.get("family_unit_id")).intValue());
        assertEquals(memId, ((Number) survey.get("family_member_id")).intValue());
        assertEquals("true", survey.get("preg"), "हाँ normalised to boolean");
        // Naegele: LMP 12/01/2026 + 9 months + 7 days = 19/10/2026
        Map<String, Object> member = jdbc.queryForMap("SELECT is_pregnant, expected_delivery_date FROM clinicqueue.family_members WHERE id = :id",
                new MapSqlParameterSource("id", memId));
        assertEquals(Boolean.TRUE, member.get("is_pregnant"));
        assertEquals(java.sql.Date.valueOf("2026-10-19"), member.get("expected_delivery_date"));

        // 4. Re-upload of the same outbox batch is idempotent
        var again = byOutbox(syncController.upload(ashaBatch()));
        assertTrue(again.values().stream().allMatch(r -> SyncRecordResult.ACCEPTED.equals(r.status())), again.toString());
        assertEquals(famId, again.get("ob-fam").serverId());
        assertEquals(3, count("SELECT COUNT(*) FROM clinicqueue.family_units WHERE asha_worker_phone = '+919876543210'"));
        assertEquals(1, count("SELECT COUNT(*) FROM clinicqueue.family_members WHERE client_uuid = 'mem-uuid-1'"));
        assertEquals(1, count("SELECT COUNT(*) FROM clinicqueue.survey_responses WHERE offline_id = 'srv-uuid-1'"));
        assertEquals(1, count("SELECT COUNT(*) FROM clinicqueue.follow_up_tasks WHERE offline_id = 'ref-uuid-1'"));

        // 5. An ASHA token is not a CHO identity
        as(ashaToken, null);
        assertEquals(HttpStatus.UNAUTHORIZED, choController.sectorReferrals("all").getStatusCode());

        // 6. A CHO outside the sector sees nothing / cannot validate
        as(otpWorkerToken(OUTSIDE_CHO), null);
        assertEquals(HttpStatus.FORBIDDEN, choController.sectorReferrals("all").getStatusCode());

        // 7. The sector CHO sees the referral with patient context (phone inherited: none here)
        as(choToken, null);
        ResponseEntity<?> listRes = choController.sectorReferrals("pending");
        assertEquals(HttpStatus.OK, listRes.getStatusCode());
        @SuppressWarnings("unchecked") List<Map<String, Object>> list = (List<Map<String, Object>>) listRes.getBody();
        Map<String, Object> ref = list.stream().filter(r -> "ref-uuid-1".equals(r.get("offlineId"))).findFirst().orElseThrow();
        assertEquals("सुमन वर्मा", ref.get("patientName"));
        assertEquals("सुनीता देवी", ref.get("ashaWorkerName"));
        assertEquals(Boolean.TRUE, ref.get("isPregnant"));
        assertEquals("PENDING", ref.get("status"));
        int taskId = ((Number) ref.get("id")).intValue();

        @SuppressWarnings("unchecked") List<Map<String, Object>> workers = (List<Map<String, Object>>) choController.sectorWorkers().getBody();
        Map<String, Object> w = workers.stream()
                .filter(x -> ChoReferralService.lastTenDigits(String.valueOf(x.get("phone"))).equals(ASHA)).findFirst().orElseThrow();
        assertEquals(3, ((Number) w.get("familyCount")).intValue());
        assertEquals(1, ((Number) w.get("pendingReferralCount")).intValue());
        assertEquals(1, ((Number) w.get("pregnantCount")).intValue());

        // 8. CHO validates (triage / transport note); repeat is idempotent
        var ok = choController.approve(taskId, Map.of("note", "108 एम्बुलेंस से FRU भेजें"));
        assertEquals(HttpStatus.OK, ok.getStatusCode());
        assertEquals(false, ok.getBody().get("alreadyApproved"));
        assertEquals(true, choController.approve(taskId, null).getBody().get("alreadyApproved"));
        as(otpWorkerToken(OUTSIDE_CHO), null);
        assertEquals(HttpStatus.FORBIDDEN, choController.approve(taskId, Map.of()).getStatusCode());

        // 9. ASHA's next download reflects the CHO validation
        as(ashaToken, null);
        SyncDownloadResponse dl = syncController.download(null).getBody();
        FollowUpTaskDto task = dl.getFollowUps().stream().filter(t -> "ref-uuid-1".equals(t.getOfflineId())).findFirst().orElseThrow();
        assertEquals("APPROVED_CHO", task.getStatus());
        assertEquals("108 एम्बुलेंस से FRU भेजें", task.getChoNote());
        assertTrue(dl.getFamilies().stream().anyMatch(f -> "fam-uuid-1".equals(f.getClientUuid()) && f.getPrimaryPhone() == null));
        assertTrue(dl.getMembers().stream().anyMatch(m -> "mem-uuid-1".equals(m.getClientUuid()) && "fam-uuid-1".equals(m.getFamilyClientUuid())));

        // 10. Soft-delete tombstone propagates (no hard delete)
        SyncUploadRequest del = new SyncUploadRequest();
        del.setDeletedFamilies(List.of(Map.of("outboxId", "ob-del", "clientUuid", "fam-uuid-3")));
        assertEquals(SyncRecordResult.ACCEPTED, byOutbox(syncController.upload(del)).get("ob-del").status());
        assertEquals(Boolean.TRUE, jdbc.queryForObject("SELECT is_deleted FROM clinicqueue.family_units WHERE client_uuid = 'fam-uuid-3'",
                new MapSqlParameterSource(), Boolean.class));
        as(ashaToken, null);
        assertTrue(syncController.download(null).getBody().getDeletedFamilyClientUuids().contains("fam-uuid-3"));
    }

    @Test
    void onlyChoCanRegisterWorkers() throws Exception {
        // OTP-verified non-worker (patient token) cannot self-register
        as(jwt.generatePatientToken("+919811122233"), null);
        assertEquals(HttpStatus.FORBIDDEN, workerController.register(
                AshaWorkerDto.builder().phone("9811122233").name("नई आशा").villageName("खेड़ा").build()).getStatusCode());
        // Anonymous cannot register either
        as(null, null);
        assertEquals(HttpStatus.FORBIDDEN, workerController.register(
                AshaWorkerDto.builder().phone("9811122244").name("अज्ञात").villageName("खेड़ा").build()).getStatusCode());
        // An ASHA token cannot register
        as(otpWorkerToken(ASHA), null);
        assertEquals(HttpStatus.FORBIDDEN, workerController.register(
                AshaWorkerDto.builder().phone("9811122255").name("x").villageName("y").build()).getStatusCode());

        // The CHO registers an ASHA and an ANM; both join the CHO's sector and get their cadre at login
        as(otpWorkerToken(CHO), null);
        assertEquals(HttpStatus.CREATED, workerController.register(
                AshaWorkerDto.builder().phone("9811166666").name("नई आशा").villageName("खेड़ा").build()).getStatusCode());
        assertEquals(HttpStatus.CREATED, workerController.register(
                AshaWorkerDto.builder().phone("9811155555").name("एएनएम").villageName("खेड़ा").role("ANM").build()).getStatusCode());
        assertEquals(HttpStatus.CONFLICT, workerController.register(
                AshaWorkerDto.builder().phone("9811166666").name("दोबारा").villageName("खेड़ा").build()).getStatusCode());
        assertEquals(Optional.of("ASHA"), identity.resolveWorkerRole("9811166666"));
        assertEquals(Optional.of("ANM"), identity.resolveWorkerRole("9811155555"));
        assertTrue(choService.sectorSize(CHO) >= 3);

        // Unregistered numbers get no worker role (app shows "contact your CHO")
        assertEquals(Optional.empty(), identity.resolveWorkerRole("9811177777"));

        // Profile auto-loads for the newly registered ASHA
        as(otpWorkerToken("9811166666"), null);
        AshaWorkerDto me = workerController.getByPhone().getBody();
        assertEquals("नई आशा", me.getName());
        assertEquals("खेड़ा", me.getVillageName());
        assertEquals("ASHA", me.getRole());
        assertEquals(0, me.getHouseholdCount());
    }
}
