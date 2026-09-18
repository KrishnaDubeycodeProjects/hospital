package com.qdischarge.clinicqueue.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.CourseDto;
import com.qdischarge.clinicqueue.dto.CreateReferralRequest;
import com.qdischarge.clinicqueue.dto.HospitalDto;
import com.qdischarge.clinicqueue.dto.ReferralDto;
import com.qdischarge.clinicqueue.exception.ReferralQuotaExceededException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ReferralServiceConcurrencyTest {

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
        objectMapper = new ObjectMapper();

        referralService = new ReferralService(
                jdbc, courseService, hospitalService, appProperties, objectMapper
        );
    }

    @Test
    void testConcurrentReferrals_EnforcesQuotaCeiling() throws InterruptedException {
        int targetHospitalId = 10;
        int urgentQuota = 3;
        int totalThreads = 10;

        when(courseService.getCourseById(anyInt())).thenReturn(
                CourseDto.builder().id(1).patientPhone("+919999999999").patientName("Test Patient").build()
        );

        when(hospitalService.getById(targetHospitalId)).thenReturn(
                HospitalDto.builder().id(targetHospitalId).name("Apex Hospital").urgentReferralQuota(urgentQuota).build()
        );

        when(jdbc.queryForList(contains("FROM hospitals WHERE id = :toHospId FOR UPDATE"), anyMap()))
                .thenReturn(List.of(Map.of(
                        "id", targetHospitalId,
                        "name", "Apex Hospital",
                        "urgent_referral_quota", urgentQuota,
                        "standard_referral_quota", 15
                )));

        // Simulated atomic in-memory counter representing the locked database rows
        AtomicInteger activeCounter = new AtomicInteger(0);
        when(jdbc.queryForObject(contains("SELECT COUNT(*) FROM course_referrals"), anyMap(), eq(Integer.class)))
                .thenAnswer(inv -> activeCounter.getAndIncrement());

        when(jdbc.queryForObject(contains("INSERT INTO course_referrals"), anyMap(), eq(Integer.class)))
                .thenReturn(1);

        when(jdbc.query(contains("SELECT r.*, c.title AS course_title"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(
                        ReferralDto.builder()
                                .id(100)
                                .courseId(1)
                                .patientPhone("+919999999999")
                                .priorityTier("urgent_7d")
                                .validUntil(LocalDate.now().plusDays(7))
                                .status("issued")
                                .build()
                ));

        ExecutorService executor = Executors.newFixedThreadPool(totalThreads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch finishLatch = new CountDownLatch(totalThreads);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger quotaExceededCount = new AtomicInteger(0);

        for (int i = 0; i < totalThreads; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await();
                    CreateReferralRequest req = new CreateReferralRequest(
                            1, null, targetHospitalId, "Cardiology", null, "Acute Chest Pain", "urgent_7d"
                    );
                    referralService.createReferral(req, 1, 1);
                    successCount.incrementAndGet();
                } catch (ReferralQuotaExceededException e) {
                    quotaExceededCount.incrementAndGet();
                } catch (Throwable e) {
                    System.err.println("UNEXPECTED CONCURRENCY EXCEPTION: " + e.getClass().getName() + " -> " + e.getMessage());
                    e.printStackTrace();
                } finally {
                    finishLatch.countDown();
                }
            });
        }

        // Fire all threads concurrently
        startLatch.countDown();
        finishLatch.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertEquals(urgentQuota, successCount.get(), "Only quota allowed referrals should succeed");
        assertEquals(totalThreads - urgentQuota, quotaExceededCount.get(), "Excess requests must receive ReferralQuotaExceededException");
    }
}
