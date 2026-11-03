package com.qdischarge.clinicqueue.asha.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class BroadcastServiceTest {

    private NamedParameterJdbcTemplate jdbc;
    private BroadcastService service;

    @BeforeEach
    void setUp() {
        jdbc = mock(NamedParameterJdbcTemplate.class);
        when(jdbc.getJdbcTemplate()).thenReturn(mock(JdbcTemplate.class));
        service = new BroadcastService(jdbc);
    }

    @Test
    void inboxIsScopedToAudienceAndSenderChain() {
        when(jdbc.queryForList(anyString(), any(SqlParameterSource.class))).thenReturn(List.of());
        service.inbox("+91 98765 43210", "ASHA");

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<SqlParameterSource> params = ArgumentCaptor.forClass(SqlParameterSource.class);
        verify(jdbc).queryForList(sql.capture(), params.capture());
        String q = sql.getValue();
        assertTrue(q.contains("b.audience IN ('ALL', :role)"), q);
        assertTrue(q.contains("b.sender_role = 'ADMIN'"), q);
        assertTrue(q.contains("a.anm_phone"), "sender must come from the worker's cadre chain: " + q);
        assertTrue(q.contains("b.is_deleted = FALSE"), q);
        MapSqlParameterSource p = (MapSqlParameterSource) params.getValue();
        assertEquals("9876543210", p.getValue("w"));
        assertEquals("ASHA", p.getValue("role"));
    }

    @Test
    void createStoresValidatedFields() {
        when(jdbc.queryForObject(anyString(), any(SqlParameterSource.class), eq(Integer.class))).thenReturn(7);
        int id = service.create("+919876522222", "CHO", "डॉ. शर्मा",
                new BroadcastService.NewBroadcast("पल्स पोलियो", "रविवार को बूथ पर रहें", "URGENT", "ASHA", LocalDate.of(2026, 11, 8)));
        assertEquals(7, id);
        ArgumentCaptor<SqlParameterSource> params = ArgumentCaptor.forClass(SqlParameterSource.class);
        verify(jdbc).queryForObject(startsWith("INSERT INTO clinicqueue.nhm_broadcasts"), params.capture(), eq(Integer.class));
        MapSqlParameterSource p = (MapSqlParameterSource) params.getValue();
        assertEquals("URGENT", p.getValue("priority"));
        assertEquals("ASHA", p.getValue("audience"));
        assertEquals(LocalDate.of(2026, 11, 8), p.getValue("due"));
    }

    @Test
    void acknowledgeIsIdempotentUpsertOnLastTenDigits() {
        service.acknowledge(3, "+91-98765-43210", true);
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<SqlParameterSource> params = ArgumentCaptor.forClass(SqlParameterSource.class);
        verify(jdbc).update(sql.capture(), params.capture());
        assertTrue(sql.getValue().contains("ON CONFLICT (broadcast_id, worker_phone)"), sql.getValue());
        assertTrue(sql.getValue().contains("COALESCE"), "first read / done time must be kept");
        MapSqlParameterSource p = (MapSqlParameterSource) params.getValue();
        assertEquals("9876543210", p.getValue("w"));
        assertEquals(true, p.getValue("done"));
    }

    @Test
    void withdrawIsSoftDeleteByOwnSenderOnly() {
        when(jdbc.update(anyString(), any(SqlParameterSource.class))).thenReturn(0);
        assertFalse(service.withdraw(3, "9876522222"));
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).update(sql.capture(), any(SqlParameterSource.class));
        assertTrue(sql.getValue().startsWith("UPDATE clinicqueue.nhm_broadcasts SET is_deleted = TRUE"), sql.getValue());
        assertTrue(sql.getValue().contains("sender_phone"), sql.getValue());
        assertFalse(sql.getValue().contains("DELETE FROM"));
    }
}
