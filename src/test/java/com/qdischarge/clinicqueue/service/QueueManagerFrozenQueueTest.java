package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.bot.BotMessages;
import com.qdischarge.clinicqueue.bot.WaSessionService;
import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.HospitalDto;
import com.qdischarge.clinicqueue.dto.TokenDto;
import com.qdischarge.clinicqueue.geo.GeoDistanceService;
import com.qdischarge.clinicqueue.geo.MapMyIndiaRoutingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class QueueManagerFrozenQueueTest {

    private NamedParameterJdbcTemplate jdbc;
    private AppProperties appProperties;
    private HospitalService hospitalService;
    private HospitalDepartmentService hospitalDepartmentService;
    private GeoDistanceService geoDistanceService;
    private OtpService otpService;
    private MapMyIndiaRoutingService mapMyIndiaRoutingService;
    private TwilioStudioCallService twilioStudioCallService;
    private BotMessages botMessages;
    private WaSessionService waSessionService;

    private QueueManagerService queueManagerService;

    @BeforeEach
    void setUp() {
        jdbc = mock(NamedParameterJdbcTemplate.class);
        appProperties = mock(AppProperties.class);
        hospitalService = mock(HospitalService.class);
        hospitalDepartmentService = mock(HospitalDepartmentService.class);
        geoDistanceService = mock(GeoDistanceService.class);
        otpService = mock(OtpService.class);
        mapMyIndiaRoutingService = mock(MapMyIndiaRoutingService.class);
        twilioStudioCallService = mock(TwilioStudioCallService.class);
        botMessages = mock(BotMessages.class);
        waSessionService = mock(WaSessionService.class);

        queueManagerService = new QueueManagerService(
                jdbc, appProperties, hospitalService, hospitalDepartmentService,
                geoDistanceService, otpService, mapMyIndiaRoutingService,
                twilioStudioCallService, botMessages, waSessionService);
    }

    @Test
    void testComputeDepartmentVacancyMinutes_UsesStrictMinimumServiceTime() {
        HospitalDto hospital = HospitalDto.builder()
                .id(1)
                .minServiceMinutes(4) // 4 minutes minimum
                .avgServiceMinutes(15) // average 15 minutes should be ignored
                .build();
        when(hospitalService.getById(1)).thenReturn(hospital);
        when(hospitalDepartmentService.activeCounters(1, "general")).thenReturn(2); // 2 active counters

        // 6 waiting tokens
        when(jdbc.queryForObject(contains("SELECT COUNT(*)::int FROM tokens"), anyMap(), eq(Integer.class)))
                .thenReturn(6);
        // 0 currently serving
        when(jdbc.query(contains("SELECT * FROM tokens WHERE status = 'serving'"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of());

        double vacancyMinutes = queueManagerService.computeDepartmentVacancyMinutes(1, "general");

        // (6 waiting * 4 min) / 2 counters = 12 minutes
        assertEquals(12.0, vacancyMinutes);
    }

    @Test
    void testUnfreezeEligibleTokens_ArrivalReached_UnfreezesAndAssignsDailyNumber() {
        HospitalDto hospital = HospitalDto.builder().id(1).minServiceMinutes(3).build();
        when(hospitalService.getById(1)).thenReturn(hospital);
        when(hospitalDepartmentService.activeCounters(1, "general")).thenReturn(1);

        TokenDto frozenToken = TokenDto.builder()
                .id(101)
                .name("John Doe")
                .hospitalId(1)
                .category("general")
                .status("frozen")
                .dailyNumber(null)
                .targetArrivalTime(LocalDateTime.now().minusMinutes(2)) // target arrival was 2 mins ago
                .createdAt(LocalDateTime.now().minusMinutes(10))
                .build();

        // Query returns our frozen token
        when(jdbc.query(contains("SELECT * FROM tokens WHERE status = 'frozen'"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(frozenToken));

        // Vacancy query
        when(jdbc.queryForObject(contains("SELECT COUNT(*)::int FROM tokens"), anyMap(), eq(Integer.class)))
                .thenReturn(0);
        when(jdbc.query(contains("SELECT * FROM tokens WHERE status = 'serving'"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of());

        // Daily number sequence query: max is currently 10 -> next is 11
        when(jdbc.queryForObject(contains("SELECT MAX(daily_number) FROM tokens"), anyMap(), eq(Integer.class)))
                .thenReturn(10);

        // Raw token lookup returning updated token details
        TokenDto updatedToken = TokenDto.builder()
                .id(101)
                .name("John Doe")
                .hospitalId(1)
                .category("general")
                .status("waiting")
                .dailyNumber(11)
                .build();
        when(jdbc.query(contains("SELECT * FROM tokens WHERE id = :id"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(updatedToken));

        List<TokenDto> unfreezed = queueManagerService.unfreezeEligibleTokens(1, "general");

        assertNotNull(unfreezed);
        assertEquals(1, unfreezed.size());
        assertEquals(11, unfreezed.get(0).getDailyNumber());

        // Verify UPDATE was executed assigning daily_number 11 and status waiting
        verify(jdbc, times(1)).update(
                contains("UPDATE tokens"),
                argThat((Map<String, Object> params) ->
                        Integer.valueOf(11).equals(params.get("dailyNumber")) &&
                        Integer.valueOf(101).equals(params.get("id"))
                )
        );
    }

    @Test
    void testVerifyTokenByAdmin_EarlyCheckinUnfreezesImmediately() {
        TokenDto frozenToken = TokenDto.builder()
                .id(202)
                .name("Alice")
                .hospitalId(1)
                .category("cardiology")
                .status("frozen")
                .dailyNumber(null)
                .build();

        // getRaw returns the frozen token
        when(jdbc.query(contains("SELECT * FROM tokens WHERE id = :id"), eq(Map.of("id", 202)), any(RowMapper.class)))
                .thenReturn(List.of(frozenToken));

        // next daily number returns 25
        when(jdbc.queryForObject(contains("SELECT MAX(daily_number) FROM tokens"), anyMap(), eq(Integer.class)))
                .thenReturn(24);

        TokenDto verifiedToken = TokenDto.builder()
                .id(202)
                .name("Alice")
                .hospitalId(1)
                .category("cardiology")
                .status("waiting")
                .dailyNumber(25)
                .isVerified(true)
                .build();

        when(jdbc.query(contains("SELECT * FROM tokens WHERE id = :id"), eq(Map.of("id", 202)), any(RowMapper.class)))
                .thenReturn(List.of(frozenToken), List.of(verifiedToken));

        TokenDto result = queueManagerService.verifyTokenByAdmin(202);

        assertNotNull(result);
        // Verify UPDATE executed setting status = 'waiting' and daily_number = 25
        verify(jdbc, times(1)).update(
                contains("UPDATE tokens"),
                argThat((Map<String, Object> params) ->
                        Integer.valueOf(25).equals(params.get("dailyNumber")) &&
                        Integer.valueOf(202).equals(params.get("id"))
                )
        );
    }

    @Test
    void testPushBackNoShow_DirectlyMarksMissed_NoExponentialShuffling() {
        TokenDto waitingToken = TokenDto.builder()
                .id(303)
                .dailyNumber(5)
                .status("waiting")
                .hospitalId(1)
                .category("general")
                .build();

        when(jdbc.query(contains("SELECT * FROM tokens WHERE id = :id"), eq(Map.of("id", 303)), any(RowMapper.class)))
                .thenReturn(List.of(waitingToken));

        TokenDto missedToken = TokenDto.builder()
                .id(303)
                .dailyNumber(5)
                .status("missed")
                .hospitalId(1)
                .category("general")
                .build();

        when(jdbc.query(contains("UPDATE tokens SET status = :status"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(missedToken));

        TokenDto result = queueManagerService.pushBackNoShow(303);

        assertNotNull(result);
        // Verify status was updated directly to 'missed'
        verify(jdbc, times(1)).query(
                contains("UPDATE tokens SET status = :status"),
                argThat((Map<String, Object> params) ->
                        "missed".equals(params.get("status")) &&
                        Integer.valueOf(303).equals(params.get("id"))
                ),
                any(RowMapper.class)
        );
    }
}
