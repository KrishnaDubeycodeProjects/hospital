package com.qdischarge.clinicqueue.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.CourseDto;
import com.qdischarge.clinicqueue.dto.CreateReferralRequest;
import com.qdischarge.clinicqueue.dto.HospitalDto;
import com.qdischarge.clinicqueue.dto.ReferralDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ReferralServiceTest {

    private NamedParameterJdbcTemplate jdbc;
    private CourseService courseService;
    private HospitalService hospitalService;
    private WhatsAppService whatsAppService;
    private AppProperties appProperties;
    private ObjectMapper objectMapper;
    private ReferralService referralService;

    @BeforeEach
    void setUp() {
        jdbc = mock(NamedParameterJdbcTemplate.class);
        courseService = mock(CourseService.class);
        hospitalService = mock(HospitalService.class);
        whatsAppService = mock(WhatsAppService.class);
        appProperties = new AppProperties();
        appProperties.setFrontendUrl("https://arogya.gov.in");
        objectMapper = new ObjectMapper();

        referralService = new ReferralService(
                jdbc, courseService, hospitalService, appProperties, objectMapper);
    }

    @Test
    void testCreateReferral_Urgent7d_Sets7DaysValidityAndGeneratesQr() {
        CourseDto course = CourseDto.builder()
                .id(10)
                .patientPhone("+919999999999")
                .patientName("Ramesh Kumar")
                .title("TB Treatment")
                .build();
        when(courseService.getCourseById(10)).thenReturn(course);

        HospitalDto targetHosp = HospitalDto.builder()
                .id(5)
                .name("District Hospital")
                .urgentReferralQuota(5)
                .build();
        when(hospitalService.getById(5)).thenReturn(targetHosp);

        when(jdbc.queryForList(contains("FROM hospitals WHERE id = :toHospId FOR UPDATE"), anyMap()))
                .thenReturn(List.of(Map.of(
                        "id", 5,
                        "name", "District Hospital",
                        "urgent_referral_quota", 5,
                        "standard_referral_quota", 15
                )));

        // Active referrals currently below quota
        when(jdbc.queryForObject(contains("SELECT COUNT(*) FROM course_referrals"), anyMap(), eq(Integer.class)))
                .thenReturn(2);

        when(jdbc.queryForObject(contains("INSERT INTO course_referrals"), anyMap(), eq(Integer.class)))
                .thenReturn(501);

        ReferralDto savedReferral = ReferralDto.builder()
                .id(501)
                .courseId(10)
                .patientPhone("+919999999999")
                .patientName("Ramesh Kumar")
                .priorityTier("urgent_7d")
                .validUntil(LocalDate.now().plusDays(7))
                .status("issued")
                .build();
        when(jdbc.query(contains("SELECT r.*, c.title AS course_title"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(savedReferral));

        CreateReferralRequest req = new CreateReferralRequest(
                10,
                null,
                5,
                "Chest & Pulmonology",
                null,
                "Suspected pyrazinamide-induced arthralgia",
                "urgent_7d"
        );

        ReferralDto result = referralService.createReferral(req, 2, 1);

        assertNotNull(result);
        assertEquals(501, result.getId());
        assertEquals("urgent_7d", result.getPriorityTier());

        // Verify valid_until was calculated as +7 days
        ArgumentCaptor<Map<String, Object>> paramsCaptor = ArgumentCaptor.forClass(Map.class);
        verify(jdbc).queryForObject(contains("INSERT INTO course_referrals"), paramsCaptor.capture(), eq(Integer.class));
        Map<String, Object> inserted = paramsCaptor.getValue();
        assertEquals(Date.valueOf(LocalDate.now().plusDays(7)), inserted.get("validUntil"));
    }

    @Test
    void testCreateReferral_ExceedsUrgentQuota_ThrowsReferralQuotaExceededException() {
        CourseDto course = CourseDto.builder()
                .id(10)
                .patientPhone("+919999999999")
                .patientName("Ramesh Kumar")
                .build();
        when(courseService.getCourseById(10)).thenReturn(course);

        when(jdbc.queryForList(contains("FROM hospitals WHERE id = :toHospId FOR UPDATE"), anyMap()))
                .thenReturn(List.of(Map.of(
                        "id", 5,
                        "name", "District Hospital",
                        "urgent_referral_quota", 5,
                        "standard_referral_quota", 15
                )));

        // Active referrals currently equal to or exceeding quota (5/5)
        when(jdbc.queryForObject(contains("SELECT COUNT(*) FROM course_referrals"), anyMap(), eq(Integer.class)))
                .thenReturn(5);

        CreateReferralRequest req = new CreateReferralRequest(
                10, null, 5, "Chest", null, "Emergency review", "urgent_7d"
        );

        com.qdischarge.clinicqueue.exception.ReferralQuotaExceededException ex = assertThrows(
                com.qdischarge.clinicqueue.exception.ReferralQuotaExceededException.class, () ->
                referralService.createReferral(req, 2, 1)
        );

        assertTrue(ex.getMessage().contains("Referral quota exceeded for urgent_7d"));
        assertEquals(5, ex.getActiveCount());
        assertEquals(5, ex.getMaxQuota());
    }
}
