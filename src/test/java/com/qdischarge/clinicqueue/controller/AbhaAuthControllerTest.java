package com.qdischarge.clinicqueue.controller;

import com.qdischarge.clinicqueue.dto.*;
import com.qdischarge.clinicqueue.security.JwtService;
import com.qdischarge.clinicqueue.service.EkaCareAbdmService;
import com.qdischarge.clinicqueue.service.FamilyUnitService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AbhaAuthControllerTest {

    private EkaCareAbdmService ekaCareAbdmService;
    private FamilyUnitService familyUnitService;
    private JwtService jwtService;
    private AbhaAuthController abhaAuthController;

    @BeforeEach
    void setUp() {
        ekaCareAbdmService = mock(EkaCareAbdmService.class);
        familyUnitService = mock(FamilyUnitService.class);
        jwtService = mock(JwtService.class);
        abhaAuthController = new AbhaAuthController(ekaCareAbdmService, familyUnitService, jwtService);
    }

    @Test
    void testInitLogin_Success() {
        when(ekaCareAbdmService.initPhrLogin("kavish@abdm"))
                .thenReturn(new EkaCareAbdmService.AbdmResult(true, 200, Map.of("txnId", "txn-12345", "maskedMobile", "******4321"), null));

        AbhaLoginInitRequest req = new AbhaLoginInitRequest("kavish@abdm");
        ResponseEntity<Map<String, Object>> response = abhaAuthController.initLogin(req);

        assertEquals(200, response.getStatusCode().value());
        assertTrue((Boolean) response.getBody().get("success"));
        assertNotNull(response.getBody().get("data"));
    }

    @Test
    void testVerifyLogin_WithRelationshipMother_Success() {
        PatientAbhaProfileDto profile = PatientAbhaProfileDto.builder()
                .name("Sonia Ahuja")
                .phone("+918850934544")
                .abhaNumber("91-4455-6677-8899")
                .abhaAddress("sonia@abdm")
                .gender("FEMALE")
                .age(48)
                .dob("1978-01-10")
                .verified(true)
                .build();

        when(ekaCareAbdmService.verifyPhrLogin("txn-12345", "123456", null))
                .thenReturn(new EkaCareAbdmService.AbdmResult(true, 200, profile, null));

        FamilyMemberDto mockMember = FamilyMemberDto.builder()
                .id(202)
                .name("Sonia Ahuja")
                .relationship("MOTHER")
                .abhaNumber("91-4455-6677-8899")
                .abhaAddress("sonia@abdm")
                .isAbhaLinked(true)
                .build();

        when(familyUnitService.provisionOrUpdateAbhaMember(
                eq("+918850934544"),
                eq("Sonia Ahuja"),
                eq("MOTHER"),
                eq("FEMALE"),
                eq(48),
                any(),
                eq("91-4455-6677-8899"),
                eq("sonia@abdm")
        )).thenReturn(mockMember);

        when(jwtService.generatePatientToken("+918850934544"))
                .thenReturn("mock_jwt_token_for_patient");

        AbhaLoginVerifyRequest req = new AbhaLoginVerifyRequest("txn-12345", "123456", "MOTHER");
        ResponseEntity<Map<String, Object>> response = abhaAuthController.verifyLogin(req);

        assertEquals(200, response.getStatusCode().value());
        assertTrue((Boolean) response.getBody().get("success"));
        assertEquals("mock_jwt_token_for_patient", response.getBody().get("token"));
        assertNotNull(response.getBody().get("familyMember"));
        FamilyMemberDto returnedMember = (FamilyMemberDto) response.getBody().get("familyMember");
        assertEquals("MOTHER", returnedMember.getRelationship());
        assertEquals("Sonia Ahuja", returnedMember.getName());
    }

    @Test
    void testVerifyLogin_SelfDefault_Success() {
        PatientAbhaProfileDto profile = PatientAbhaProfileDto.builder()
                .name("Kavish Ahuja")
                .phone("+918850934544")
                .abhaNumber("91-1122-3344-5566")
                .abhaAddress("kavish@abdm")
                .gender("MALE")
                .age(20)
                .dob("2006-03-15")
                .verified(true)
                .build();

        when(ekaCareAbdmService.verifyPhrLogin("txn-self", "654321", null))
                .thenReturn(new EkaCareAbdmService.AbdmResult(true, 200, profile, null));

        FamilyMemberDto mockMember = FamilyMemberDto.builder()
                .id(101)
                .name("Kavish Ahuja")
                .relationship("SELF")
                .isAbhaLinked(true)
                .build();

        when(familyUnitService.provisionOrUpdateAbhaMember(
                eq("+918850934544"),
                eq("Kavish Ahuja"),
                eq("SELF"),
                eq("MALE"),
                eq(20),
                any(),
                eq("91-1122-3344-5566"),
                eq("kavish@abdm")
        )).thenReturn(mockMember);

        when(jwtService.generatePatientToken("+918850934544"))
                .thenReturn("jwt_for_kavish");

        AbhaLoginVerifyRequest req = new AbhaLoginVerifyRequest("txn-self", "654321", null);
        ResponseEntity<Map<String, Object>> response = abhaAuthController.verifyLogin(req);

        assertEquals(200, response.getStatusCode().value());
        assertTrue((Boolean) response.getBody().get("success"));
        assertEquals("jwt_for_kavish", response.getBody().get("token"));
        FamilyMemberDto returnedMember = (FamilyMemberDto) response.getBody().get("familyMember");
        assertEquals("SELF", returnedMember.getRelationship());
    }
}
