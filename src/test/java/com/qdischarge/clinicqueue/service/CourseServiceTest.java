package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.dto.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CourseServiceTest {

    private NamedParameterJdbcTemplate jdbc;
    private DocumentStorageService documentStorageService;
    private EkaCareAbdmService ekaCareAbdmService;
    private CourseService courseService;

    @BeforeEach
    void setUp() {
        jdbc = mock(NamedParameterJdbcTemplate.class);
        documentStorageService = mock(DocumentStorageService.class);
        ekaCareAbdmService = mock(EkaCareAbdmService.class);
        courseService = new CourseService(jdbc, documentStorageService, ekaCareAbdmService);
    }

    @Test
    void testCreateCourse_Success() {
        CreateCourseRequest req = new CreateCourseRequest(
                "+919999999999",
                "Ramesh Kumar",
                null,
                "tb_treatment",
                "TB Treatment",
                "Pulmonary Tuberculosis",
                "A15.0",
                "Initial presentation with chronic cough and sputum positive AFB."
        );

        when(jdbc.queryForObject(contains("INSERT INTO courses"), anyMap(), eq(Integer.class)))
                .thenReturn(10);
        when(jdbc.queryForObject(contains("INSERT INTO course_encounters"), anyMap(), eq(Integer.class)))
                .thenReturn(100);

        CourseDto createdCourse = CourseDto.builder()
                .id(10)
                .patientPhone("+919999999999")
                .patientName("Ramesh Kumar")
                .courseType("tb_treatment")
                .title("TB Treatment")
                .status("active")
                .build();
        when(jdbc.query(contains("SELECT c.*, d.name AS started_by_doctor_name"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(createdCourse));

        CourseDto result = courseService.createCourse(req, 1, 1);

        assertNotNull(result);
        assertEquals(10, result.getId());
        assertEquals("active", result.getStatus());
        verify(jdbc).queryForObject(contains("INSERT INTO courses"), anyMap(), eq(Integer.class));
    }

    @Test
    void testGetBundledConsentTypes_PerCondition() {
        List<String> tbBundle = courseService.getBundledConsentTypes("tb_treatment");
        assertTrue(tbBundle.contains("Sputum AFB Reports"));
        assertTrue(tbBundle.contains("Chest X-Ray"));
        assertTrue(tbBundle.contains("Treatment Prescriptions"));

        List<String> ancBundle = courseService.getBundledConsentTypes("anc_pregnancy");
        assertTrue(ancBundle.contains("Hb & Blood Reports"));
        assertTrue(ancBundle.contains("Ultrasound Scans"));

        List<String> htnBundle = courseService.getBundledConsentTypes("hypertension");
        assertTrue(htnBundle.contains("BP Readings"));
        assertTrue(htnBundle.contains("ECG"));
    }

    @Test
    void testCloseCourse() {
        when(jdbc.update(contains("UPDATE courses SET status = 'completed'"), anyMap())).thenReturn(1);
        CourseDto completedCourse = CourseDto.builder().id(10).status("completed").build();
        when(jdbc.query(contains("SELECT c.*, d.name AS started_by_doctor_name"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(completedCourse));

        CourseDto result = courseService.closeCourse(10);

        assertNotNull(result);
        assertEquals("completed", result.getStatus());
        verify(jdbc).update(contains("UPDATE courses SET status = 'completed'"), argThat((Map<String, ?> map) ->
                map.get("id").equals(10)
        ));
    }
}
