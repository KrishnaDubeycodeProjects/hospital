package com.qdischarge.clinicqueue.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class QueueMaintenanceSchedulerTest {

    private QueueManagerService queueManagerService;
    private NamedParameterJdbcTemplate jdbc;
    private QueueMaintenanceScheduler scheduler;

    @BeforeEach
    void setUp() {
        queueManagerService = mock(QueueManagerService.class);
        jdbc = mock(NamedParameterJdbcTemplate.class);
        scheduler = new QueueMaintenanceScheduler(queueManagerService, jdbc);
    }

    @Test
    void testCleanExpiredTokens_InvokesService() {
        scheduler.cleanExpiredTokens();
        verify(queueManagerService, times(1)).cleanExpiredTokens();
    }

    @Test
    void testPurgeStaleOtps_ExecutesDeleteQuery() {
        when(jdbc.update(contains("DELETE FROM otp_verifications"), anyMap())).thenReturn(5);
        scheduler.purgeStaleOtps();
        verify(jdbc, times(1)).update(contains("DELETE FROM otp_verifications"), anyMap());
    }

    @Test
    void testPurgeExpiredAccessRequests_ExecutesDeleteQuery() {
        when(jdbc.update(contains("DELETE FROM access_requests"), anyMap())).thenReturn(3);
        scheduler.purgeExpiredAccessRequests();
        verify(jdbc, times(1)).update(contains("DELETE FROM access_requests"), anyMap());
    }
}
