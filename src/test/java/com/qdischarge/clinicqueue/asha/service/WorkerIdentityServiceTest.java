package com.qdischarge.clinicqueue.asha.service;

import com.qdischarge.clinicqueue.config.AppProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class WorkerIdentityServiceTest {

    private NamedParameterJdbcTemplate jdbc;
    private AppProperties props;
    private WorkerIdentityService service;

    @BeforeEach
    void setUp() {
        jdbc = mock(NamedParameterJdbcTemplate.class);
        props = new AppProperties();
        service = new WorkerIdentityService(jdbc, props, mock(SyncService.class));
        // Default: no rows anywhere
        when(jdbc.queryForObject(anyString(), any(SqlParameterSource.class), eq(Integer.class))).thenReturn(0);
        when(jdbc.query(anyString(), any(SqlParameterSource.class), any(RowMapper.class))).thenReturn(Collections.emptyList());
    }

    @SuppressWarnings("unchecked")
    private void workerRow(String role) {
        when(jdbc.query(contains("asha_workers w"), any(SqlParameterSource.class), any(RowMapper.class))).thenReturn((List) List.of(role));
    }

    @Test
    void unknownPhoneIsNotAWorker() {
        assertEquals(Optional.empty(), service.resolveWorkerRole("+91 98111 11111"));
        assertEquals(Optional.empty(), service.resolveWorkerRole("12345"));
    }

    @Test
    void configuredChoPhoneResolvesToCho() {
        props.setChoPhones("+91 98765 22222, 9000000000");
        assertEquals(Optional.of("CHO"), service.resolveWorkerRole("9876522222"));
    }

    @Test
    void registeredWorkerRowDecidesCadre() {
        workerRow("ASHA");
        assertEquals(Optional.of("ASHA"), service.resolveWorkerRole("9876543210"));
    }

    @Test
    void registeredAnmRowResolvesToAnm() {
        workerRow("ANM");
        assertEquals(Optional.of("ANM"), service.resolveWorkerRole("9876511111"));
    }

    @Test
    void ashaCannotEscalateViaAutoCreatedAnmProfile() {
        workerRow("ASHA");
        // anm_profiles row exists too (e.g. auto-created by a session call)
        when(jdbc.queryForObject(contains("anm_profiles"), any(SqlParameterSource.class), eq(Integer.class))).thenReturn(1);
        assertEquals(Optional.of("ASHA"), service.resolveWorkerRole("9876543210"));
    }

    @Test
    void standaloneAnmProfileResolvesToAnm() {
        when(jdbc.queryForObject(contains("anm_profiles"), any(SqlParameterSource.class), eq(Integer.class))).thenReturn(1);
        assertEquals(Optional.of("ANM"), service.resolveWorkerRole("9876511111"));
    }
}
