package com.qdischarge.clinicqueue.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.Authentication;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CourseSecurityTest {

    private NamedParameterJdbcTemplate jdbc;
    private CurrentUser currentUser;
    private CourseSecurity courseSecurity;
    private Authentication auth;

    @BeforeEach
    void setUp() {
        jdbc = mock(NamedParameterJdbcTemplate.class);
        currentUser = mock(CurrentUser.class);
        auth = mock(Authentication.class);
        courseSecurity = new CourseSecurity(jdbc, currentUser);
    }

    @Test
    void testAdminAccess_AlwaysGranted() {
        when(currentUser.isAdmin()).thenReturn(true);
        assertTrue(courseSecurity.canAccessCourse(auth, 101));
        assertTrue(courseSecurity.canAccessReferral(auth, 501));
    }

    @Test
    void testPatientAccess_MatchingPhone_Granted() {
        when(currentUser.isPatient()).thenReturn(true);
        when(currentUser.getPatientPhone()).thenReturn("+919876543210");
        when(jdbc.queryForObject(contains("FROM courses WHERE id = :courseId AND patient_phone = :phone"), anyMap(), eq(Integer.class)))
                .thenReturn(1);

        assertTrue(courseSecurity.canAccessCourse(auth, 101));
    }

    @Test
    void testPatientAccess_MismatchedPhone_Denied() {
        when(currentUser.isPatient()).thenReturn(true);
        when(currentUser.getPatientPhone()).thenReturn("+919876543210");
        when(jdbc.queryForObject(contains("FROM courses WHERE id = :courseId AND patient_phone = :phone"), anyMap(), eq(Integer.class)))
                .thenReturn(0);

        assertFalse(courseSecurity.canAccessCourse(auth, 101));
    }

    @Test
    void testDoctorAccess_InitiatingDoctor_Granted() {
        when(currentUser.isDoctor()).thenReturn(true);
        when(currentUser.getDoctorId()).thenReturn(7);
        when(jdbc.queryForObject(contains("SELECT hospital_id FROM doctors"), anyMap(), eq(Integer.class)))
                .thenReturn(1);
        when(jdbc.queryForObject(contains("FROM courses WHERE id = :courseId AND started_by_doctor_id = :doctorId"), anyMap(), eq(Integer.class)))
                .thenReturn(1);

        assertTrue(courseSecurity.canAccessCourse(auth, 101));
    }

    @Test
    void testDoctorAccess_ActiveReferral_Granted() {
        when(currentUser.isDoctor()).thenReturn(true);
        when(currentUser.getDoctorId()).thenReturn(9);
        when(jdbc.queryForObject(contains("SELECT hospital_id FROM doctors"), anyMap(), eq(Integer.class)))
                .thenReturn(2);
        // Not creator
        when(jdbc.queryForObject(contains("FROM courses WHERE id = :courseId AND started_by_doctor_id = :doctorId"), anyMap(), eq(Integer.class)))
                .thenReturn(0);
        // Has active referral to hospital #2
        when(jdbc.queryForObject(contains("FROM course_referrals"), anyMap(), eq(Integer.class)))
                .thenReturn(1);

        assertTrue(courseSecurity.canAccessCourse(auth, 101));
    }

    @Test
    void testDoctorAccess_ActiveAccessGrant_Granted() {
        when(currentUser.isDoctor()).thenReturn(true);
        when(currentUser.getDoctorId()).thenReturn(11);
        when(jdbc.queryForObject(contains("SELECT hospital_id FROM doctors"), anyMap(), eq(Integer.class)))
                .thenReturn(3);
        when(jdbc.queryForObject(contains("FROM courses WHERE id = :courseId AND started_by_doctor_id = :doctorId"), anyMap(), eq(Integer.class)))
                .thenReturn(0);
        when(jdbc.queryForObject(contains("FROM course_referrals"), anyMap(), eq(Integer.class)))
                .thenReturn(0);
        // Has approved access grant
        when(jdbc.queryForObject(contains("FROM access_grants ag"), anyMap(), eq(Integer.class)))
                .thenReturn(1);

        assertTrue(courseSecurity.canAccessCourse(auth, 101));
    }

    @Test
    void testDoctorAccess_UnaffiliatedDoctor_Denied() {
        when(currentUser.isDoctor()).thenReturn(true);
        when(currentUser.getDoctorId()).thenReturn(99);
        when(jdbc.queryForObject(contains("SELECT hospital_id FROM doctors"), anyMap(), eq(Integer.class)))
                .thenReturn(4);
        when(jdbc.queryForObject(contains("FROM courses WHERE id = :courseId AND started_by_doctor_id = :doctorId"), anyMap(), eq(Integer.class)))
                .thenReturn(0);
        when(jdbc.queryForObject(contains("FROM course_referrals"), anyMap(), eq(Integer.class)))
                .thenReturn(0);
        when(jdbc.queryForObject(contains("FROM access_grants ag"), anyMap(), eq(Integer.class)))
                .thenReturn(0);

        assertFalse(courseSecurity.canAccessCourse(auth, 101));
    }
}
