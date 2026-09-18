package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.dto.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class FhirBundleServiceTest {

    private CourseService courseService;
    private NamedParameterJdbcTemplate jdbc;
    private FhirBundleService fhirBundleService;

    @BeforeEach
    void setUp() {
        courseService = mock(CourseService.class);
        jdbc = mock(NamedParameterJdbcTemplate.class);
        fhirBundleService = new FhirBundleService(courseService, jdbc);
    }

    @Test
    void testCreateEncounterBundle_ValidFhirR4() {
        CourseDto course = CourseDto.builder()
                .id(10)
                .patientPhone("+919999999999")
                .patientName("Ramesh Kumar")
                .title("Pulmonary TB Treatment")
                .build();

        CoursePrescriptionDto rx = CoursePrescriptionDto.builder()
                .id(101)
                .medicineName("Amoxicillin 500mg")
                .snomedCode("27658006")
                .dosage("1-0-1")
                .frequency("Twice daily")
                .durationDays(5)
                .build();

        CourseEncounterDto encounter = CourseEncounterDto.builder()
                .id(50)
                .courseId(10)
                .doctorId(1)
                .doctorName("Dr. Sharma")
                .hospitalId(1)
                .hospitalName("District General Hospital")
                .visitDate(LocalDateTime.now())
                .chiefComplaint("Productive cough for 2 weeks")
                .clinicalNotes("Bilateral rhonchi present")
                .plan("Start antibiotics, monitor temperature")
                .prescriptions(List.of(rx))
                .documents(List.of())
                .build();

        CourseTimelineDto timeline = CourseTimelineDto.builder()
                .course(course)
                .encounters(List.of(encounter))
                .build();

        when(courseService.getCourseTimeline(10)).thenReturn(timeline);

        Map<String, Object> bundle = fhirBundleService.createEncounterBundle(10, 50);

        assertNotNull(bundle);
        assertEquals("Bundle", bundle.get("resourceType"));
        assertEquals("document", bundle.get("type"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> entries = (List<Map<String, Object>>) bundle.get("entry");
        assertNotNull(entries);
        assertTrue(entries.size() >= 5); // Composition, Patient, Practitioner, Organization, Encounter, MedicationRequest

        // Verify Composition resource
        Map<String, Object> compEntry = entries.get(0);
        @SuppressWarnings("unchecked")
        Map<String, Object> composition = (Map<String, Object>) compEntry.get("resource");
        assertEquals("Composition", composition.get("resourceType"));
        assertEquals("final", composition.get("status"));

        // Verify MedicationRequest
        boolean hasMed = entries.stream().anyMatch(e -> {
            @SuppressWarnings("unchecked")
            Map<String, Object> res = (Map<String, Object>) e.get("resource");
            return "MedicationRequest".equals(res.get("resourceType"));
        });
        assertTrue(hasMed, "Bundle must contain MedicationRequest entry");
    }
}
