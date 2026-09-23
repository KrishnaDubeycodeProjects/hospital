package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.bot.BotMessages;
import com.qdischarge.clinicqueue.bot.Lang;
import com.qdischarge.clinicqueue.bot.WaSessionService;
import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.CreateTokenResult;
import com.qdischarge.clinicqueue.dto.HospitalDto;
import com.qdischarge.clinicqueue.dto.SetLocationRequest;
import com.qdischarge.clinicqueue.dto.TokenDto;
import com.qdischarge.clinicqueue.dto.TravelRangeDto;
import com.qdischarge.clinicqueue.geo.GeoDistanceService;
import com.qdischarge.clinicqueue.geo.MapMyIndiaRoutingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class QueueEdgeCasesCriticalTest {

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
    private WhatsAppService whatsAppService;

    private QueueManagerService queueManagerService;
    private CounterAssignmentService counterAssignmentService;

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
        botMessages = new BotMessages();
        waSessionService = mock(WaSessionService.class);
        whatsAppService = mock(WhatsAppService.class);

        HospitalDto mockHospital = HospitalDto.builder()
                .id(1)
                .name("City Care Hospital")
                .minServiceMinutes(5)
                .avgServiceMinutes(10)
                .latitude(28.6139)
                .longitude(77.2090)
                .build();
        when(hospitalService.getById(1)).thenReturn(mockHospital);

        queueManagerService = new QueueManagerService(
                jdbc, appProperties, hospitalService, hospitalDepartmentService,
                geoDistanceService, otpService, mapMyIndiaRoutingService,
                twilioStudioCallService, botMessages, waSessionService, whatsAppService);

        counterAssignmentService = new CounterAssignmentService(
                jdbc, queueManagerService, hospitalDepartmentService,
                whatsAppService, botMessages, waSessionService);
    }

    /**
     * Sub-Case 3A: Patient arrives within buffer (e.g. at t = 12 min when T_reach = 20 min).
     * Receptionist verifies patient.
     * Verification must:
     * 1. Shift all active waiting tokens down by 1.
     * 2. Award Position #1 (queue_position = 1, is_verified = true, status = 'waiting').
     * 3. Send receptionCheckInConfirmedReserved WhatsApp notification.
     */
    @Test
    void testSubCase3A_PatientArrivesWithinBuffer_AwardsPosition1_SendsWhatsAppAlert() {
        int tokenId = 301;
        String phone = "+919876500031";

        TokenDto reservedToken = TokenDto.builder()
                .id(tokenId)
                .phone(phone)
                .name("Baby Ananya")
                .hospitalId(1)
                .category("Paediatrics")
                .status("reserved")
                .targetArrivalTime(LocalDateTime.now().plusMinutes(8)) // buffer still has 8 mins
                .isVerified(false)
                .tokenCode("AF-PD03")
                .dailyNumber(3)
                .build();

        // Mock raw token retrieval
        when(jdbc.query(contains("SELECT * FROM tokens WHERE id = :id"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(reservedToken));

        // Mock token details after update
        TokenDto verifiedToken = TokenDto.builder()
                .id(tokenId)
                .phone(phone)
                .name("Baby Ananya")
                .hospitalId(1)
                .category("Paediatrics")
                .status("waiting")
                .queuePosition(1)
                .isVerified(true)
                .tokenCode("AF-PD03")
                .dailyNumber(3)
                .build();
        when(jdbc.query(contains("SELECT * FROM tokens WHERE id = :id LIMIT 1"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(verifiedToken));

        // Execute reception check-in
        TokenDto result = queueManagerService.verifyTokenByAdmin(tokenId);

        // Verify waiting queue shifted down
        verify(jdbc).update(contains("SET queue_position = queue_position + 1"), anyMap());

        // Verify token updated to waiting with Position #1 and verified
        verify(jdbc).update(contains("SET status = 'waiting', queue_position = 1"), anyMap());

        // Verify WhatsApp notification was sent to patient
        ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
        verify(whatsAppService).sendWhatsAppMessage(eq(phone), messageCaptor.capture());

        String message = messageCaptor.getValue();
        System.out.println("CAPTURED MESSAGE IN 3A:\n" + message);
        assertTrue(message.contains("RECEPTION CHECK-IN CONFIRMED"));
        assertTrue(message.contains("Position #1 (TOP PRIORITY)"));
        assertTrue(message.contains("AF-PD03"));
    }

    /**
     * Sub-Case 3B: Buffer expired without check-in.
     * System automatically processes expired buffer:
     * 1. Moves token to main waiting queue at top (Position #1).
     * 2. Since unverified at the top, immediately triggers exponential demotion.
     * 3. Demotes by 1 position (new position #2).
     * 4. Sends exponential demotion WhatsApp alert to the patient.
     */
    @Test
    void testSubCase3B_BufferExpired_MovesToTop_TriggersExponentialDemotionImmediately() {
        int tokenId = 305;
        String phone = "+919876500035";

        TokenDto expiredReserved = TokenDto.builder()
                .id(tokenId)
                .phone(phone)
                .name("Karan Johar")
                .hospitalId(1)
                .category("General Medicine")
                .status("reserved")
                .targetArrivalTime(LocalDateTime.now().minusMinutes(2)) // Expired 2 minutes ago
                .isVerified(false)
                .tokenCode("AF-GM05")
                .dailyNumber(5)
                .noShowCount(0)
                .build();

        // 1. Query for expired reserved tokens finds token 305 once, then empty on subsequent calls
        when(jdbc.query(contains("status = 'reserved'"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(expiredReserved), Collections.emptyList());

        // When getRaw(tokenId) is called
        TokenDto movedToWaiting = TokenDto.builder()
                .id(tokenId)
                .phone(phone)
                .name("Karan Johar")
                .hospitalId(1)
                .category("General Medicine")
                .status("waiting")
                .queuePosition(1)
                .isVerified(false)
                .tokenCode("AF-GM05")
                .dailyNumber(5)
                .noShowCount(0)
                .build();
        when(jdbc.query(contains("SELECT * FROM tokens WHERE id = :id"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(movedToWaiting));

        // Other waiting tokens list (contains token 306)
        when(jdbc.queryForList(contains("WHERE status = 'waiting' AND id != :id"), anyMap(), eq(Integer.class)))
                .thenReturn(new java.util.ArrayList<>(List.of(306)));

        // Execute expired reservation processing
        List<TokenDto> processed = queueManagerService.processExpiredReservations(1, "General Medicine");

        assertFalse(processed.isEmpty());

        // Verify shift to Position #1
        verify(jdbc).update(contains("SET status = 'waiting', queue_position = 1, priority_rank = 1"), anyMap());

        // Verify exponential demotion triggered (no_show_count updated)
        verify(jdbc).update(contains("UPDATE tokens SET no_show_count ="), anyMap());

        // Verify WhatsApp exponential demotion alert sent
        ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
        verify(whatsAppService).sendWhatsAppMessage(eq(phone), messageCaptor.capture());

        String message = messageCaptor.getValue();
        System.out.println("CAPTURED MESSAGE IN 3B:\n" + message);
        assertTrue(message.contains("TURN SKIPPED - QUEUE UPDATE"));
        assertTrue(message.contains("Turn moved back by: 1 position"));
        assertTrue(message.contains("AF-GM05"));
    }

    /**
     * TC Edge 4: Multi-counter assignment with fixed 2 patients per counter.
     * When Counter 1 completes treatment, it directly forwards the patient
     * that was prefixed/earmarked for Counter 1 (reserved_counter_id = 1).
     */
    @Test
    void testTCEdge4_MultiCounter_DirectForwardPrefixedPatientOnCompletion() {
        int hospitalId = 1;
        String category = "Cardiology";
        int counterId = 1;

        TokenDto servingToken = TokenDto.builder()
                .id(401)
                .phone("+919876500041")
                .name("Vikram Malhotra")
                .hospitalId(hospitalId)
                .category(category)
                .counterId(counterId)
                .status("serving")
                .tokenCode("AF-CA01")
                .build();

        TokenDto prefixedPatient = TokenDto.builder()
                .id(402)
                .phone("+919876500042")
                .name("Meera Sen")
                .hospitalId(hospitalId)
                .category(category)
                .reservedCounterId(counterId)
                .status("waiting")
                .queuePosition(1)
                .tokenCode("AF-CA02")
                .build();

        when(hospitalDepartmentService.activeCounters(hospitalId, category)).thenReturn(2);

        // Ensure counters are already considered assigned so ensureInitialAssignment does not reseed
        when(jdbc.queryForObject(contains("COUNT(*)::int FROM tokens"), anyMap(), eq(Integer.class)))
                .thenReturn(1);

        // finishCounter returns the completed serving token
        when(jdbc.query(contains("WHERE counter_id = :c"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(servingToken));

        // claimIntoCounter finds prefixed patient for Counter 1
        when(jdbc.query(contains("WHERE status = 'waiting' AND reserved_counter_id = :counterId"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(prefixedPatient));

        // Directly forwards into Counter 1
        when(jdbc.query(contains("UPDATE tokens SET status = 'serving', served_at = NOW(), counter_id = :c"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(prefixedPatient));

        // Complete treatment at counter 1
        counterAssignmentService.completeAtCounter(hospitalId, category, counterId);

        // Verify patient 402 was claimed directly into Counter 1
        verify(jdbc, times(1)).query(contains("UPDATE tokens SET status = 'serving', served_at = NOW(), counter_id = :c, reserved_counter_id = NULL"), anyMap(), any(RowMapper.class));

        // Verify now serving notification sent to Meera Sen for Counter 1
        ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
        verify(whatsAppService).sendWhatsAppMessage(eq("+919876500042"), messageCaptor.capture());

        String message = messageCaptor.getValue();
        System.out.println("CAPTURED MESSAGE IN 4:\n" + message);
        assertTrue(message.contains("NOW SERVING - IT'S YOUR TURN"));
        assertTrue(message.contains("Counter 1"));
        assertTrue(message.contains("AF-CA02"));
    }

    /**
     * Edge Test: Time-deficit booking creates token in 'frozen' status with no daily number
     * and dispatches frozenTokenBookedNotification WhatsApp alert.
     */
    @Test
    void testFrozenToken_TimeDeficitBooking_CreatesFrozenStatus_SendsWhatsAppAlert() {
        int hospitalId = 1;
        String category = "Paediatrics";
        String phone = "+919876543210";

        // Vacancy calculation queries
        when(hospitalDepartmentService.activeCounters(hospitalId, category)).thenReturn(1);
        when(jdbc.queryForObject(contains("COUNT(*)::int FROM tokens WHERE status = 'waiting'"), anyMap(), eq(Integer.class)))
                .thenReturn(2); // 2 patients * 5 min = 10 min vacancy
        when(jdbc.query(contains("WHERE status = 'serving'"), anyMap(), any(RowMapper.class)))
                .thenReturn(Collections.emptyList());

        // Hospital location resolution mock
        when(hospitalService.resolveLocation(any())).thenReturn(new HospitalService.LatLon("110001", 28.6139, 77.2090));

        // MapMyIndia routing estimate returns 30 min commute
        when(mapMyIndiaRoutingService.estimate(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(new TravelRangeDto(30.0, 15.0, 20, 45, true));

        // Mock DB insert returning new token ID
        when(jdbc.queryForObject(contains("INSERT INTO tokens"), anyMap(), eq(Integer.class)))
                .thenReturn(701);

        TokenDto frozenToken = TokenDto.builder()
                .id(701)
                .name("Arjun Verma")
                .phone(phone)
                .hospitalId(hospitalId)
                .category(category)
                .status("frozen")
                .selectedTravelMinutes(30)
                .targetArrivalTime(LocalDateTime.now().plusMinutes(30))
                .dailyNumber(null)
                .build();
        when(jdbc.query(contains("SELECT * FROM tokens WHERE id = :id"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(frozenToken));

        // Execute createToken with 30 min travel time
        SetLocationRequest loc = new SetLocationRequest("110001", 28.6139, 77.2090);
        CreateTokenResult result = queueManagerService.createToken(
                "Arjun Verma", 25, "male", category, phone, loc, hospitalId, 30);

        assertNotNull(result);

        // Verify status inserted was frozen and dailyNumber was null
        ArgumentCaptor<Map<String, Object>> insertParamsCaptor = ArgumentCaptor.forClass(Map.class);
        verify(jdbc).queryForObject(contains("INSERT INTO tokens"), insertParamsCaptor.capture(), eq(Integer.class));
        Map<String, Object> insertParams = insertParamsCaptor.getValue();
        assertEquals("frozen", insertParams.get("status"));
        assertNull(insertParams.get("dailyNumber"));

        // Verify WhatsApp frozen alert sent with arrival window and advice to leave immediately
        ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
        verify(whatsAppService).sendWhatsAppMessage(eq(phone), messageCaptor.capture());
        String msg = messageCaptor.getValue();
        assertTrue(msg.contains("HEAD OUT NOW"));
        assertTrue(msg.contains("scheduled to activate"));
        assertFalse(msg.contains("Estimated Travel Time"));
    }

    /**
     * Edge Test: Dynamic unfreezing assigns official sequential daily_number,
     * updates status to waiting, renumbers positions, and sends tokenUnfrozenActiveNotification.
     */
    @Test
    void testManualUnfreezeToken_AssignsDailyNumber_SendsWhatsAppAlert() {
        int tokenId = 705;
        String phone = "+919876543215";

        TokenDto existingFrozen = TokenDto.builder()
                .id(tokenId)
                .name("Kavita Rao")
                .phone(phone)
                .hospitalId(1)
                .category("Cardiology")
                .status("frozen")
                .targetArrivalTime(LocalDateTime.now().plusMinutes(5))
                .dailyNumber(null)
                .build();

        when(jdbc.query(contains("SELECT * FROM tokens WHERE id = :id"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(existingFrozen));

        // Mock next daily number calculation
        when(jdbc.queryForObject(contains("COALESCE(MAX(daily_number), 0)"), anyMap(), eq(Integer.class)))
                .thenReturn(6);

        TokenDto unfrozenToken = TokenDto.builder()
                .id(tokenId)
                .name("Kavita Rao")
                .phone(phone)
                .hospitalId(1)
                .category("Cardiology")
                .status("waiting")
                .dailyNumber(7)
                .tokenCode("AF-CA07")
                .queuePosition(3)
                .build();
        when(jdbc.query(contains("SELECT * FROM tokens WHERE id = :id LIMIT 1"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(unfrozenToken));

        // Execute manual unfreeze
        TokenDto result = queueManagerService.manualUnfreezeToken(tokenId);

        // Verify updated to waiting with assigned daily_number 7
        verify(jdbc).update(contains("SET status = 'waiting', daily_number = :dailyNumber"), anyMap());

        // Verify WhatsApp alert sent with activated status and daily number
        ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
        verify(whatsAppService).sendWhatsAppMessage(eq(phone), messageCaptor.capture());
        String msg = messageCaptor.getValue();
        System.out.println("CAPTURED UNFROZEN MSG:\n" + msg);
        assertTrue(msg.contains("TOKEN ACTIVATED IN QUEUE"));
        assertTrue(msg.contains("AF-CA07") || msg.contains("Kavita Rao"));
    }

    /**
     * Edge Test: Unverified patient at top of queue with available arrival time
     * enters dynamic buffer ('reserved') and sends bufferPeriodStartedNotification.
     */
    @Test
    void testUnverifiedCandidateAtTop_WithAvailableTime_EntersBuffer_SendsWhatsAppAlert() {
        int hospitalId = 1;
        String category = "Dermatology";

        // Candidate 1 at top: unverified, target arrival time in future (has 10 mins remaining)
        Map<String, Object> candidate1 = Map.of("id", 801, "is_verified", false);
        // Candidate 2 behind: verified
        Map<String, Object> candidate2 = Map.of("id", 802, "is_verified", true);

        // Return candidates list
        when(jdbc.queryForList(contains("SELECT id, is_verified, notified_ready_at, anomaly_control_until FROM tokens WHERE status = 'waiting'"), anyMap()))
                .thenReturn(List.of(candidate1, candidate2), List.of(candidate2));

        TokenDto unverifiedToken = TokenDto.builder()
                .id(801)
                .phone("+919876543221")
                .name("Rahul Sen")
                .hospitalId(hospitalId)
                .category(category)
                .status("waiting")
                .isVerified(false)
                .tokenCode("AF-DM01")
                .dailyNumber(1)
                .targetArrivalTime(LocalDateTime.now().plusMinutes(10))
                .build();
        when(jdbc.query(contains("SELECT * FROM tokens WHERE id = :id"), eq(Map.of("id", 801)), any(RowMapper.class)))
                .thenReturn(List.of(unverifiedToken));

        TokenDto verifiedToken = TokenDto.builder()
                .id(802)
                .phone("+919876543222")
                .name("Pooja Nair")
                .hospitalId(hospitalId)
                .category(category)
                .status("waiting")
                .isVerified(true)
                .tokenCode("AF-DM02")
                .dailyNumber(2)
                .build();
        when(jdbc.query(contains("UPDATE tokens SET status = 'serving', served_at = NOW(), no_show_count = 0 WHERE id = :id"), eq(Map.of("id", 802)), any(RowMapper.class)))
                .thenReturn(List.of(verifiedToken));

        // Execute claim
        TokenDto claimed = queueManagerService.claimNextEligibleWaitingTokenForCounter(hospitalId, category);

        // Candidate 1 updated to reserved buffer
        verify(jdbc).update(contains("UPDATE tokens SET status = 'reserved', queue_position = NULL WHERE id = :id"), eq(Map.of("id", 801)));

        // Candidate 1 received buffer notification
        ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
        verify(whatsAppService).sendWhatsAppMessage(eq("+919876543221"), messageCaptor.capture());
        String msg = messageCaptor.getValue();
        System.out.println("CAPTURED BUFFER MSG:\n" + msg);
        assertTrue(msg.contains("YOUR TURN HAS ARRIVED — BUFFER ACTIVE"));
        assertTrue(msg.contains("AF-DM01"));

        // Candidate 2 served
        assertNotNull(claimed);
        assertEquals(802, claimed.getId());
    }

    /**
     * Edge Test: Unverified patient at top of queue with EXPIRED arrival time
     * directly undergoes exponential demotion WITHOUT entering buffer.
     */
    @Test
    void testUnverifiedCandidateAtTop_WithExpiredArrival_DirectExponentialDemotionWithoutBuffer() {
        int hospitalId = 1;
        String category = "Orthopaedics";

        // Candidate 1 at top: unverified, target arrival time in past (expired 5 mins ago)
        Map<String, Object> candidate1 = Map.of("id", 901, "is_verified", false);
        Map<String, Object> candidate2 = Map.of("id", 902, "is_verified", true);

        when(jdbc.queryForList(contains("SELECT id, is_verified, notified_ready_at, anomaly_control_until FROM tokens WHERE status = 'waiting'"), anyMap()))
                .thenReturn(List.of(candidate1, candidate2), List.of(candidate2));

        TokenDto expiredToken = TokenDto.builder()
                .id(901)
                .phone("+919876543231")
                .name("Naveen Kumar")
                .hospitalId(hospitalId)
                .category(category)
                .status("waiting")
                .isVerified(false)
                .tokenCode("AF-OR01")
                .dailyNumber(1)
                .noShowCount(0)
                .targetArrivalTime(LocalDateTime.now().minusMinutes(5)) // Expired!
                .build();
        when(jdbc.query(contains("SELECT * FROM tokens WHERE id = :id"), eq(Map.of("id", 901)), any(RowMapper.class)))
                .thenReturn(List.of(expiredToken));

        TokenDto verifiedToken = TokenDto.builder()
                .id(902)
                .phone("+919876543232")
                .name("Sanjay Patel")
                .hospitalId(hospitalId)
                .category(category)
                .status("waiting")
                .isVerified(true)
                .tokenCode("AF-OR02")
                .dailyNumber(2)
                .build();
        when(jdbc.query(contains("UPDATE tokens SET status = 'serving', served_at = NOW(), no_show_count = 0 WHERE id = :id"), eq(Map.of("id", 902)), any(RowMapper.class)))
                .thenReturn(List.of(verifiedToken));

        // Execute claim
        TokenDto claimed = queueManagerService.claimNextEligibleWaitingTokenForCounter(hospitalId, category);

        // Verify Candidate 1 NEVER put into status = 'reserved'
        verify(jdbc, never()).update(contains("UPDATE tokens SET status = 'reserved'"), anyMap());

        // Verify pushBackNoShow (exponential demotion) was executed for candidate 1
        verify(jdbc).update(contains("UPDATE tokens SET no_show_count ="), anyMap());

        // Verify Candidate 2 served
        assertNotNull(claimed);
        assertEquals(902, claimed.getId());
    }
}

