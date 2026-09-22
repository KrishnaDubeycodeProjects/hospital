package com.qdischarge.clinicqueue.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.qdischarge.clinicqueue.config.AppProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class EkaCareAbdmServiceTest {

    private AppProperties appProperties;
    private RestTemplate restTemplate;
    private ObjectMapper objectMapper;
    private EkaCareAbdmService abdmService;

    @BeforeEach
    void setUp() {
        appProperties = new AppProperties();
        appProperties.setEkaClientId("TEST_CLIENT_ID");
        appProperties.setEkaClientSecret("TEST_SECRET");
        appProperties.setEkaBaseUrl("https://api.eka.care");

        restTemplate = mock(RestTemplate.class);
        objectMapper = new ObjectMapper();
        abdmService = new EkaCareAbdmService(appProperties, restTemplate, objectMapper);
    }

    @Test
    void testAuthenticationSuccess() {
        String authResponseJson = "{\"access_token\": \"dummy_token_12345\"}";
        when(restTemplate.postForEntity(contains("/connect-auth/v1/account/login"), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok(authResponseJson));

        String token = abdmService.getAccessToken();
        assertEquals("dummy_token_12345", token);
    }

    @Test
    void testCheckAbhaAddress() {
        String authResponseJson = "{\"access_token\": \"dummy_token_12345\"}";
        when(restTemplate.postForEntity(contains("/connect-auth/v1/account/login"), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok(authResponseJson));

        String addressResponseJson = "{\"status\": \"success\", \"available\": true}";
        when(restTemplate.exchange(contains("/abdm/v1/registration/check-address"), eq(HttpMethod.GET), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok(addressResponseJson));

        EkaCareAbdmService.AbdmResult result = abdmService.checkAbhaAddress("ramesh@abdm");
        assertTrue(result.success());
        assertEquals(200, result.status());
    }

    @Test
    void testSearchLiveLabs() {
        String authResponseJson = "{\"access_token\": \"dummy_token_12345\"}";
        when(restTemplate.postForEntity(contains("/connect-auth/v1/account/login"), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok(authResponseJson));

        String labResponseJson = "{\"drugs\": [], \"lab_tests\": [{\"id\": \"lp-123\", \"name\": \"Complete Blood Count\", \"common_name\": \"CBC\"}]}";
        when(restTemplate.exchange(contains("/medical-db/v1/drugs-and-labs"), eq(HttpMethod.GET), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok(labResponseJson));

        var labs = abdmService.searchLiveLabs("CBC", 5);
        assertNotNull(labs);
        assertEquals(1, labs.size());
        assertEquals("Complete Blood Count", labs.get(0).getName());
        assertTrue(labs.get(0).getIsLive());
    }

    @Test
    void testGetGatewayStatus() {
        String authResponseJson = "{\"access_token\": \"dummy_token_12345\", \"expires_in\": 3600}";
        when(restTemplate.postForEntity(contains("/connect-auth/v1/account/login"), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok(authResponseJson));

        var status = abdmService.getGatewayStatus();
        assertNotNull(status);
        assertEquals(true, status.get("configured"));
        assertEquals(true, status.get("authenticated"));
        assertEquals(true, status.get("liveMedicalDbAvailable"));
    }

    @Test
    void testInitPhrLoginSuccess() {
        String authResponseJson = "{\"access_token\": \"dummy_token_12345\"}";
        when(restTemplate.postForEntity(contains("/connect-auth/v1/account/login"), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok(authResponseJson));

        String phrInitResponseJson = "{\"status\": \"success\", \"txn_id\": \"txn-9988\", \"masked_mobile\": \"******4321\"}";
        when(restTemplate.exchange(contains("/abdm/na/v1/profile/login/phr"), eq(HttpMethod.POST), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok(phrInitResponseJson));

        EkaCareAbdmService.AbdmResult result = abdmService.initPhrLogin("kavish@abdm");
        assertTrue(result.success());
        assertEquals(200, result.status());
    }

    @Test
    void testVerifyPhrLoginSuccess() {
        String authResponseJson = "{\"access_token\": \"dummy_token_12345\"}";
        when(restTemplate.postForEntity(contains("/connect-auth/v1/account/login"), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok(authResponseJson));

        String verifyResponseJson = """
                {
                  "status": "success",
                  "data": {
                    "name": "Kavish Ahuja",
                    "mobile": "9876543210",
                    "health_id_number": "91-1234-5678-9012",
                    "health_id": "kavish@abdm",
                    "gender": "MALE",
                    "year_of_birth": "2004",
                    "address": "Mumbai"
                  }
                }
                """;
        when(restTemplate.exchange(contains("/abdm/na/v1/profile/login/verify"), eq(HttpMethod.POST), any(), eq(String.class)))
                .thenReturn(ResponseEntity.ok(verifyResponseJson));

        EkaCareAbdmService.AbdmResult result = abdmService.verifyPhrLogin("txn-9988", "123456", "kavish@abdm");
        assertTrue(result.success());
        assertNotNull(result.data());
        assertTrue(result.data() instanceof com.qdischarge.clinicqueue.dto.PatientAbhaProfileDto);
        com.qdischarge.clinicqueue.dto.PatientAbhaProfileDto profile = (com.qdischarge.clinicqueue.dto.PatientAbhaProfileDto) result.data();
        assertEquals("Kavish Ahuja", profile.getName());
        assertEquals("+919876543210", profile.getPhone());
        assertEquals("91-1234-5678-9012", profile.getAbhaNumber());
    }

    @Test
    void testFetchPatientMedicalHistory() {
        var history = abdmService.fetchPatientMedicalHistory("kavish@abdm", "+919876543210");
        assertNotNull(history);
        assertFalse(history.isEmpty());
        assertTrue(history.stream().anyMatch(r -> "Prescription".equalsIgnoreCase(r.getType())));
        assertTrue(history.stream().anyMatch(r -> "DiagnosticReport".equalsIgnoreCase(r.getType())));
    }
}

