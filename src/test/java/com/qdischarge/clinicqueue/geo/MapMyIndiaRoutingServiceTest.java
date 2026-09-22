package com.qdischarge.clinicqueue.geo;

import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.TravelRangeDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MapMyIndiaRoutingServiceTest {

    private AppProperties appProperties;
    private RestTemplate restTemplate;
    private GeoDistanceService geoDistanceService;
    private MapMyIndiaRoutingService service;

    @BeforeEach
    void setUp() {
        appProperties = mock(AppProperties.class);
        restTemplate = mock(RestTemplate.class);
        geoDistanceService = mock(GeoDistanceService.class);
        service = new MapMyIndiaRoutingService(appProperties, restTemplate, geoDistanceService);
    }

    @Test
    void testEstimate_FallbackWhenNoApiKey() {
        when(appProperties.getMapplsApiKey()).thenReturn(null);
        when(geoDistanceService.distanceKm(anyDouble(), anyDouble(), anyDouble(), anyDouble())).thenReturn(5.0);
        when(geoDistanceService.estimatedTravelMinutes(5.0)).thenReturn(10.0);

        TravelRangeDto result = service.estimate(28.6139, 77.2090, 28.5355, 77.3910);

        assertNotNull(result);
        assertEquals(5.0, result.distanceKm());
        assertEquals(10.0, result.baseMinutes());
        // -10% of 10 = 9, +50% of 10 = 15
        assertEquals(9, result.minMinutes());
        assertEquals(15, result.maxMinutes());
        assertFalse(result.fromMappls());
        verifyNoInteractions(restTemplate);
    }

    @Test
    void testEstimate_SuccessfulMapplsCall() {
        when(appProperties.getMapplsApiKey()).thenReturn("test-api-key");
        when(appProperties.getMapplsBaseUrl()).thenReturn("https://apis.mappls.com/advancedmaps/v1");
        when(appProperties.getMapplsServerIp()).thenReturn("192.168.1.100");

        Map<String, Object> routeData = Map.of(
                "duration", 1200.0, // 20 minutes (1200s)
                "distance", 8000.0  // 8 km (8000m)
        );
        Map<String, Object> responseBody = Map.of("routes", List.of(routeData));
        ResponseEntity<Map> responseEntity = ResponseEntity.ok(responseBody);

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(responseEntity);

        TravelRangeDto result = service.estimate(28.6139, 77.2090, 28.5355, 77.3910);

        assertNotNull(result);
        assertEquals(8.0, result.distanceKm());
        assertEquals(20.0, result.baseMinutes());
        // -10% of 20 = 18, +50% of 20 = 30
        assertEquals(18, result.minMinutes());
        assertEquals(30, result.maxMinutes());
        assertTrue(result.fromMappls());
    }

    @Test
    void testEstimate_MapplsErrorFallsBackGracefully() {
        when(appProperties.getMapplsApiKey()).thenReturn("test-api-key");
        when(appProperties.getMapplsBaseUrl()).thenReturn("https://apis.mappls.com/advancedmaps/v1");
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class)))
                .thenThrow(new RuntimeException("Mappls connection timeout"));

        when(geoDistanceService.distanceKm(anyDouble(), anyDouble(), anyDouble(), anyDouble())).thenReturn(2.0);
        when(geoDistanceService.estimatedTravelMinutes(2.0)).thenReturn(4.0);

        TravelRangeDto result = service.estimate(28.6139, 77.2090, 28.5355, 77.3910);

        assertNotNull(result);
        assertEquals(2.0, result.distanceKm());
        assertEquals(4.0, result.baseMinutes());
        // -10% of 4 = 3.6 -> 4, +50% of 4 = 6
        assertEquals(4, result.minMinutes());
        assertEquals(6, result.maxMinutes());
        assertFalse(result.fromMappls());
    }
}
