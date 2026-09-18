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
}
