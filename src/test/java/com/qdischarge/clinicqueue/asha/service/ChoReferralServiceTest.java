package com.qdischarge.clinicqueue.asha.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ChoReferralServiceTest {

    private NamedParameterJdbcTemplate jdbc;
    private ChoReferralService service;

    @BeforeEach
    void setUp() {
        jdbc = mock(NamedParameterJdbcTemplate.class);
        service = new ChoReferralService(jdbc, mock(SyncService.class));
    }

    @Test
    void phonesCompareOnLastTenDigits() {
        assertEquals("9876522222", ChoReferralService.lastTenDigits("+91 98765 22222"));
        assertEquals("9876522222", ChoReferralService.lastTenDigits("+919876522222"));
        assertEquals("9876522222", ChoReferralService.lastTenDigits("9876522222"));
        assertEquals("", ChoReferralService.lastTenDigits(null));
    }

    @Test
    @SuppressWarnings("unchecked")
    void approveIsScopedToSectorAndReportsNotInSector() {
        when(jdbc.query(anyString(), any(SqlParameterSource.class), any(RowMapper.class))).thenReturn(Collections.emptyList());

        assertEquals(ChoReferralService.ApproveOutcome.NOT_IN_SECTOR, service.approve("+91 98765 22222", 42, "PHC भेजें"));

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<SqlParameterSource> params = ArgumentCaptor.forClass(SqlParameterSource.class);
        verify(jdbc, times(2)).query(sql.capture(), params.capture(), any(RowMapper.class));
        String update = sql.getAllValues().get(0);
        assertTrue(update.startsWith("UPDATE clinicqueue.follow_up_tasks"), update);
        assertTrue(update.contains("asha_workers"), "update must be restricted to the CHO's sector workers");
        assertTrue(update.contains("t.task_type IN (:types)"), update);
        MapSqlParameterSource p = (MapSqlParameterSource) params.getAllValues().get(0);
        assertEquals("9876522222", p.getValue("cho"));
        assertEquals("PHC भेजें", p.getValue("note"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void approveIsIdempotentForAlreadyValidatedReferral() {
        when(jdbc.query(startsWith("UPDATE"), any(SqlParameterSource.class), any(RowMapper.class))).thenReturn(Collections.emptyList());
        when(jdbc.query(startsWith("SELECT t.status"), any(SqlParameterSource.class), any(RowMapper.class))).thenReturn((List) List.of("APPROVED_CHO"));
        assertEquals(ChoReferralService.ApproveOutcome.ALREADY_APPROVED, service.approve("9876522222", 42, null));
    }

    @Test
    @SuppressWarnings("unchecked")
    void approveSucceedsWhenRowUpdated() {
        when(jdbc.query(startsWith("UPDATE"), any(SqlParameterSource.class), any(RowMapper.class))).thenReturn((List) List.of(42));
        assertEquals(ChoReferralService.ApproveOutcome.APPROVED, service.approve("9876522222", 42, " "));
    }
}
