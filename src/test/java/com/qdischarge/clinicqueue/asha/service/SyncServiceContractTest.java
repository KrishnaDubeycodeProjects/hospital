package com.qdischarge.clinicqueue.asha.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qdischarge.clinicqueue.asha.dto.SyncRecordResult;
import com.qdischarge.clinicqueue.asha.dto.SyncUploadRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Contract-level checks for sync v2 that do not need a database: unresolvable references are
 * rejected (never bound to "family 1"), and every lookup is scoped to the caller's phone.
 */
class SyncServiceContractTest {

    private NamedParameterJdbcTemplate jdbc;
    private SyncService service;

    @BeforeEach
    void setUp() {
        jdbc = mock(NamedParameterJdbcTemplate.class);
        when(jdbc.getJdbcTemplate()).thenReturn(mock(JdbcTemplate.class));
        // Every lookup finds nothing.
        when(jdbc.query(anyString(), any(SqlParameterSource.class), any(RowMapper.class))).thenReturn(Collections.emptyList());
        service = new SyncService(jdbc, new ObjectMapper(), mock(SurveyService.class));
    }

    @SuppressWarnings("unchecked")
    private static List<SyncRecordResult> results(Map<String, Object> response) {
        return (List<SyncRecordResult>) response.get("results");
    }

    @Test
    void memberWithUnknownFamilyIsRejectedAsRetryable() {
        SyncUploadRequest req = new SyncUploadRequest();
        req.setMembers(List.of(Map.of(
                "outboxId", "ob-1",
                "clientUuid", "8b0f3c1e-member",
                "familyClientUuid", "f012-0000-0000-0012",
                "name", "सुमन",
                "relationship", "पत्नी")));

        Map<String, Object> response = service.upload("9876543210", req);
        SyncRecordResult r = results(response).get(0);

        assertEquals("ob-1", r.outboxId());
        assertEquals("8b0f3c1e-member", r.clientUuid());
        assertEquals(SyncRecordResult.REJECTED, r.status());
        assertEquals("FAMILY_NOT_FOUND", r.reason());
        assertTrue(r.retryable());
        assertNull(r.serverId());
        assertEquals(2, response.get("contractVersion"));
        // No INSERT may have been attempted against a guessed family.
        verify(jdbc, never()).queryForObject(contains("INSERT INTO clinicqueue.family_members"), any(SqlParameterSource.class), eq(Integer.class));
    }

    @Test
    void surveyWithUnknownMemberIsRejectedNotDefaultedToOne() {
        SyncUploadRequest req = new SyncUploadRequest();
        req.setSurveys(List.of(Map.of(
                "outboxId", "ob-2",
                "offlineId", "survey-uuid",
                "familyClientUuid", "fam-uuid",
                "memberClientUuid", "mem-uuid",
                "categoryCode", "PREGNANCY",
                "answers", Map.of("isPregnant", "हाँ"))));

        SyncRecordResult r = results(service.upload("9876543210", req)).get(0);
        assertEquals(SyncRecordResult.REJECTED, r.status());
        assertEquals("FAMILY_NOT_FOUND", r.reason());
        assertEquals("survey-uuid", r.clientUuid());
    }

    @Test
    void lookupsAreScopedToCallerAndUuidIsNotParsedAsId() {
        SyncUploadRequest req = new SyncUploadRequest();
        req.setMembers(List.of(Map.of("outboxId", "ob-3", "clientUuid", "m-uuid",
                "familyClientUuid", "f012-0000-0000-0012", "name", "राम", "relationship", "पुत्र")));
        service.upload("+919876543210", req);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<SqlParameterSource> params = ArgumentCaptor.forClass(SqlParameterSource.class);
        verify(jdbc, atLeastOnce()).query(sql.capture(), params.capture(), any(RowMapper.class));

        String familyLookup = sql.getAllValues().stream().filter(s -> s.contains("family_units")).findFirst().orElseThrow();
        assertTrue(familyLookup.contains("client_uuid = :uuid"), familyLookup);
        assertTrue(familyLookup.contains("asha_worker_phone = :ashaPhone"), familyLookup);
        MapSqlParameterSource p = (MapSqlParameterSource) params.getAllValues().get(sql.getAllValues().indexOf(familyLookup));
        assertEquals("f012-0000-0000-0012", p.getValue("uuid"));
        assertEquals("9876543210", p.getValue("rawPhone"));
        assertFalse(p.hasValue("id"), "a client UUID must never be digit-scraped into a numeric id");
    }

    @Test
    void deleteOfRecordNeverUploadedIsAcceptedAsNotOnServer() {
        SyncUploadRequest req = new SyncUploadRequest();
        req.setDeletedMembers(List.of(Map.of("outboxId", "ob-4", "clientUuid", "never-synced")));
        SyncRecordResult r = results(service.upload("9876543210", req)).get(0);
        assertEquals(SyncRecordResult.ACCEPTED, r.status());
        assertEquals("NOT_ON_SERVER", r.reason());
        verify(jdbc, never()).update(contains("is_deleted = TRUE"), any(SqlParameterSource.class));
    }
}
