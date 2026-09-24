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
        when(appProperties.getGeoAvgSpeedKmh()).thenReturn(25.0);
    }

    @Test
    void testEstimate_FallbackWhenNoApiKey() {
        when(appProperties.getTomtomApiKey()).thenReturn(null);
        when(appProperties.getMapplsApiKey()).thenReturn(null);
        when(geoDistanceService.distanceKm(anyDouble(), anyDouble(), anyDouble(), anyDouble())).thenReturn(5.0);

        TravelRangeDto result = service.estimate(28.6139, 77.2090, 28.5355, 77.3910);

        assertNotNull(result);
        // Fallback road estimate = 5.0 * 1.25 = 6.25 km
        assertEquals(6.25, result.distanceKm());
        // At 25 km/h: (6.25 / 25) * 60 = 15.0 minutes
        assertEquals(15.0, result.baseMinutes());
        assertEquals(15, result.minMinutes());
        assertEquals(15, result.maxMinutes());
        assertFalse(result.fromMappls());
        verifyNoInteractions(restTemplate);
    }

    @Test
    void testEstimate_SuccessfulTomTomCall() {
        when(appProperties.getTomtomApiKey()).thenReturn("tomtom-test-key");
        when(geoDistanceService.distanceKm(anyDouble(), anyDouble(), anyDouble(), anyDouble())).thenReturn(10.0);

        Map<String, Object> summary = Map.of(
                "lengthInMeters", 13000.0, // 13.0 km (1.3x straight-line, perfectly reasonable)
                "travelTimeInSeconds", 1560.0 // 26 minutes (speed ~30 km/h)
        );
        Map<String, Object> routeData = Map.of("summary", summary);
        Map<String, Object> responseBody = Map.of("routes", List.of(routeData));

        when(restTemplate.getForObject(contains("api.tomtom.com"), eq(Map.class)))
                .thenReturn(responseBody);

        TravelRangeDto result = service.estimate(28.6139, 77.2090, 28.5355, 77.3910);

        assertNotNull(result);
        assertEquals(13.0, result.distanceKm());
        assertEquals(26.0, result.baseMinutes());
        assertEquals(26, result.minMinutes());
        assertEquals(26, result.maxMinutes());
        assertTrue(result.fromMappls());
    }

    @Test
    void testEstimate_SuccessfulMapplsCall_WhenTomTomNotConfigured() {
        when(appProperties.getTomtomApiKey()).thenReturn(null);
        when(appProperties.getMapplsApiKey()).thenReturn("mappls-test-key");
        when(appProperties.getMapplsBaseUrl()).thenReturn("https://apis.mappls.com/advancedmaps/v1");
        when(appProperties.getMapplsServerIp()).thenReturn("192.168.1.100");
        when(geoDistanceService.distanceKm(anyDouble(), anyDouble(), anyDouble(), anyDouble())).thenReturn(6.0);

        Map<String, Object> routeData = Map.of(
                "duration", 1200.0, // 20 minutes (1200s)
                "distance", 8000.0  // 8 km (8000m, 1.33x straight-line)
        );
        Map<String, Object> responseBody = Map.of("routes", List.of(routeData));
        ResponseEntity<Map> responseEntity = ResponseEntity.ok(responseBody);

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(responseEntity);

        TravelRangeDto result = service.estimate(28.6139, 77.2090, 28.5355, 77.3910);

        assertNotNull(result);
        assertEquals(8.0, result.distanceKm());
        assertEquals(20.0, result.baseMinutes());
        assertEquals(20, result.minMinutes());
        assertEquals(20, result.maxMinutes());
        assertTrue(result.fromMappls());
    }

    @Test
    void testEstimate_AbruptHighDistanceContrastingOutput_IsClampedByContrastGuard() {
        when(appProperties.getTomtomApiKey()).thenReturn("tomtom-test-key");
        // Straight line distance is only 5.0 km
        when(geoDistanceService.distanceKm(anyDouble(), anyDouble(), anyDouble(), anyDouble())).thenReturn(5.0);

        // Routing engine glitches and returns 150 km and 300 minutes (wild contrast / detouring into another state)
        Map<String, Object> summary = Map.of(
                "lengthInMeters", 150000.0, // 150 km! (30x straight-line)
                "travelTimeInSeconds", 18000.0 // 300 minutes
        );
        Map<String, Object> routeData = Map.of("summary", summary);
        Map<String, Object> responseBody = Map.of("routes", List.of(routeData));

        when(restTemplate.getForObject(contains("api.tomtom.com"), eq(Map.class)))
                .thenReturn(responseBody);

        TravelRangeDto result = service.estimate(28.6139, 77.2090, 28.5355, 77.3910);

        assertNotNull(result);
        // Contrast guard detects the wild discrepancy and clamps to realistic 1.25x road circuity: 5.0 * 1.25 = 6.25 km
        assertEquals(6.25, result.distanceKm());
        // Calibrated duration at 25 km/h: (6.25 / 25) * 60 = 15.0 minutes
        assertEquals(15.0, result.baseMinutes());
        assertEquals(15, result.minMinutes());
        assertEquals(15, result.maxMinutes());
        // Marked as not from API because contrast anomaly was sanitized
        assertFalse(result.fromMappls());
    }

    @Test
    void testEstimate_AbruptSmallDistance_TriangleInequalityViolation_IsClamped() {
        when(appProperties.getTomtomApiKey()).thenReturn("tomtom-test-key");
        // Straight line distance is 10.0 km
        when(geoDistanceService.distanceKm(anyDouble(), anyDouble(), anyDouble(), anyDouble())).thenReturn(10.0);

        // API glitches and returns 2 km (physically impossible for road to be 20% of straight line)
        Map<String, Object> summary = Map.of(
                "lengthInMeters", 2000.0,
                "travelTimeInSeconds", 300.0
        );
        Map<String, Object> routeData = Map.of("summary", summary);
        Map<String, Object> responseBody = Map.of("routes", List.of(routeData));

        when(restTemplate.getForObject(contains("api.tomtom.com"), eq(Map.class)))
                .thenReturn(responseBody);

        TravelRangeDto result = service.estimate(28.6139, 77.2090, 28.5355, 77.3910);

        assertNotNull(result);
        // Clamped to 10.0 * 1.25 = 12.5 km
        assertEquals(12.5, result.distanceKm());
        // Duration calibrated: (12.5 / 25) * 60 = 30.0 minutes
        assertEquals(30.0, result.baseMinutes());
        assertFalse(result.fromMappls());
    }

    @Test
    void testEstimate_AbruptSpeedContrastingOutput_IsCalibrated() {
        when(appProperties.getTomtomApiKey()).thenReturn("tomtom-test-key");
        when(geoDistanceService.distanceKm(anyDouble(), anyDouble(), anyDouble(), anyDouble())).thenReturn(10.0);

        // Road distance 12 km (fine), but duration is 20 seconds! (speed = 2160 km/h - extreme outlier)
        Map<String, Object> summary = Map.of(
                "lengthInMeters", 12000.0,
                "travelTimeInSeconds", 20.0
        );
        Map<String, Object> routeData = Map.of("summary", summary);
        Map<String, Object> responseBody = Map.of("routes", List.of(routeData));

        when(restTemplate.getForObject(contains("api.tomtom.com"), eq(Map.class)))
                .thenReturn(responseBody);

        TravelRangeDto result = service.estimate(28.6139, 77.2090, 28.5355, 77.3910);

        assertNotNull(result);
        assertEquals(12.0, result.distanceKm());
        // Speed outlier is recalibrated to 25 km/h: (12.0 / 25) * 60 = 28.8 minutes
        assertEquals(28.8, result.baseMinutes());
        assertEquals(29, result.minMinutes());
        assertFalse(result.fromMappls());
    }

    @Test
    void testEstimate_ExtremeProximity_HandledCleanly() {
        // Less than 50 meters straight-line
        when(geoDistanceService.distanceKm(anyDouble(), anyDouble(), anyDouble(), anyDouble())).thenReturn(0.02);

        TravelRangeDto result = service.estimate(28.6139, 77.2090, 28.61391, 77.20901);

        assertNotNull(result);
        assertEquals(0.05, result.distanceKm());
        assertEquals(1.0, result.baseMinutes());
        assertEquals(1, result.minMinutes());
        assertEquals(1, result.maxMinutes());
        verifyNoInteractions(restTemplate);
    }

    @Test
    void testNormalizeCoordinates_SwappedLatLonAutoCorrected() {
        // Inverted: lat is 77.2090, lon is 28.6139
        MapMyIndiaRoutingService.LatLonPair pair = service.normalizeCoordinates(77.2090, 28.6139);
        assertEquals(28.6139, pair.lat());
        assertEquals(77.2090, pair.lon());

        // Normal: lat is 28.6139, lon is 77.2090
        MapMyIndiaRoutingService.LatLonPair normalPair = service.normalizeCoordinates(28.6139, 77.2090);
        assertEquals(28.6139, normalPair.lat());
        assertEquals(77.2090, normalPair.lon());
    }
}
