package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.bot.BotMessages;
import com.qdischarge.clinicqueue.bot.WaSessionService;
import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.HospitalDto;
import com.qdischarge.clinicqueue.dto.TokenDto;
import com.qdischarge.clinicqueue.geo.GeoDistanceService;
import com.qdischarge.clinicqueue.geo.MapMyIndiaRoutingService;
import com.qdischarge.clinicqueue.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Regression for "booking a different hospital shows my old Aastha receipt":
 * an active token for the phone must only be handed back when it is for the
 * same hospital, department and patient -- never silently for another hospital/person.
 */
class BookingActiveTokenScopeTest {

    private NamedParameterJdbcTemplate jdbc;
    private HospitalService hospitalService;
    private QueueManagerService queueManagerService;

    private static final String PHONE = "+919111111111";
    private static final String CATEGORY = "Paediatrics";

    @BeforeEach
    void setUp() {
        jdbc = mock(NamedParameterJdbcTemplate.class);
        hospitalService = mock(HospitalService.class);
        when(hospitalService.getById(1)).thenReturn(HospitalDto.builder().id(1).name("Aastha Hospital").build());
        when(hospitalService.getById(2)).thenReturn(HospitalDto.builder().id(2).name("City Care Hospital").build());

        queueManagerService = new QueueManagerService(
                jdbc, mock(AppProperties.class), hospitalService, mock(HospitalDepartmentService.class),
                mock(GeoDistanceService.class), mock(OtpService.class), mock(MapMyIndiaRoutingService.class),
                mock(TwilioStudioCallService.class), new BotMessages(), mock(WaSessionService.class),
                mock(WhatsAppService.class), mock(JwtService.class), mock(FamilyUnitService.class));
    }

    @SuppressWarnings("unchecked")
    private void givenActiveToken(int hospitalId, String patientName) {
        TokenDto active = TokenDto.builder()
                .id(501).name(patientName).phone(PHONE)
                .hospitalId(hospitalId).category(CATEGORY).status("waiting")
                .build();
        when(jdbc.query(contains("WHERE phone IN (:phones)"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(active));
    }

    @Test
    void activeTokenAtAnotherHospital_isNotReturned_bookingIsRefusedWithReason() {
        givenActiveToken(1, "Asha Patel");

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                queueManagerService.createToken("Asha Patel", 30, "female", CATEGORY, PHONE, null, 2, null));

        assertTrue(ex.getMessage().contains("Aastha Hospital"), ex.getMessage());
        verify(jdbc, never()).queryForObject(contains("INSERT INTO tokens"), anyMap(), eq(Integer.class));
    }

    @Test
    void activeTokenForAnotherFamilyMember_isNotReturnedAsThisPatientsReceipt() {
        givenActiveToken(2, "Asha Patel");

        assertThrows(IllegalStateException.class, () ->
                queueManagerService.createToken("Ravi Patel", 8, "male", CATEGORY, PHONE, null, 2, null));
        verify(jdbc, never()).queryForObject(contains("INSERT INTO tokens"), anyMap(), eq(Integer.class));
    }
}
