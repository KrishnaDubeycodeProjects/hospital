package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.controller.CourseController;
import com.qdischarge.clinicqueue.dto.*;
import com.qdischarge.clinicqueue.event.ConsultationCompletedEvent;
import com.qdischarge.clinicqueue.security.CurrentUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ConsultationTransactionTest {

    private CourseService courseService;
    private DoctorService doctorService;
    private ReferralService referralService;
    private QueueManagerService queueManagerService;
    private CurrentUser currentUser;
    private ApplicationEventPublisher eventPublisher;
    private AppProperties appProperties;
    private CourseController courseController;

    @BeforeEach
    void setUp() {
        courseService = mock(CourseService.class);
        doctorService = mock(DoctorService.class);
        referralService = mock(ReferralService.class);
        queueManagerService = mock(QueueManagerService.class);
        currentUser = mock(CurrentUser.class);
        eventPublisher = mock(ApplicationEventPublisher.class);
        appProperties = new AppProperties();

        courseController = new CourseController(
                courseService, doctorService, referralService, queueManagerService, currentUser, eventPublisher, appProperties
        );
    }

    @Test
    void testCompleteAndNext_Success_PublishesEventAndAdvancesQueue() {
        when(currentUser.requireDoctorId()).thenReturn(10);
        DoctorDto doctor = DoctorDto.builder().id(10).hospitalId(1).category("General OPD").build();
        when(doctorService.getById(10)).thenReturn(doctor);

        CourseDto course = CourseDto.builder().id(100).patientPhone("+919999999999").patientName("Patient X").build();
        when(courseService.getCourseById(100)).thenReturn(course);

        CourseEncounterDto encounter = CourseEncounterDto.builder().id(200).build();
        when(courseService.addEncounter(any(), eq(10), eq(1))).thenReturn(encounter);

        UpdateStatusResult updateResult = new UpdateStatusResult(
                TokenDto.builder().id(300).status("completed").build(),
                1
        );
        when(queueManagerService.updateTokenStatus("300", "completed")).thenReturn(updateResult);

        CompleteAndNextRequest req = new CompleteAndNextRequest(
                "Cough", "Viral bronchitis", "Normal", "Rest and hydration", null, null, 300
        );

        ResponseEntity<Map<String, Object>> response = courseController.completeAndNext(100, req);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertTrue((Boolean) response.getBody().get("success"));

        // Verify event was published for post-commit dispatch
        verify(eventPublisher, times(1)).publishEvent(any(ConsultationCompletedEvent.class));
    }

    @Test
    void testCompleteAndNext_TokenUpdateFails_ThrowsExceptionAndNoEventPublished() {
        when(currentUser.requireDoctorId()).thenReturn(10);
        DoctorDto doctor = DoctorDto.builder().id(10).hospitalId(1).category("General OPD").build();
        when(doctorService.getById(10)).thenReturn(doctor);

        CourseDto course = CourseDto.builder().id(100).patientPhone("+919999999999").patientName("Patient X").build();
        when(courseService.getCourseById(100)).thenReturn(course);

        CourseEncounterDto encounter = CourseEncounterDto.builder().id(200).build();
        when(courseService.addEncounter(any(), eq(10), eq(1))).thenReturn(encounter);

        // Queue update fails (returns null)
        when(queueManagerService.updateTokenStatus("300", "completed")).thenReturn(null);

        CompleteAndNextRequest req = new CompleteAndNextRequest(
                "Cough", "Viral bronchitis", "Normal", "Rest", null, null, 300
        );

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                courseController.completeAndNext(100, req)
        );

        assertTrue(ex.getMessage().contains("Failed to complete queue token"));
        // Ensure no event was published
        verify(eventPublisher, never()).publishEvent(any());
    }
}
