package com.qdischarge.clinicqueue.geo;

import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.TravelRangeDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

/**
 * Travel-time and distance estimation using MapMyIndia (Mappls) Routing API.
 * Provides a dynamic travel window with a -10% to +50% range from which
 * the patient can select their expected travel duration.
 *
 * Falls back to GeoDistanceService straight-line Haversine math if credentials
 * are missing or external requests fail.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MapMyIndiaRoutingService {

    private final AppProperties appProperties;
    private final RestTemplate restTemplate;
    private final GeoDistanceService geoDistanceService;

    /**
     * Estimates travel duration and returns a -10% to +50% travel duration window.
     * hospitalLat/hospitalLon = destination, patientLat/patientLon = origin.
     */
    public TravelRangeDto estimate(double hospitalLat, double hospitalLon, double patientLat, double patientLon) {
        String apiKey = appProperties.getMapplsApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            return fallback(hospitalLat, hospitalLon, patientLat, patientLon);
        }

        try {
            return callMappls(apiKey, patientLat, patientLon, hospitalLat, hospitalLon);
        } catch (Exception e) {
            log.warn("⚠️ MapMyIndia (Mappls) routing error ({}) -- falling back to straight-line estimate.", e.getMessage());
            return fallback(hospitalLat, hospitalLon, patientLat, patientLon);
        }
    }

    @SuppressWarnings("unchecked")
    private TravelRangeDto callMappls(String apiKey, double originLat, double originLon, double destLat, double destLon) {
        String baseUrl = appProperties.getMapplsBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "https://apis.mappls.com/advancedmaps/v1";
        }
        baseUrl = baseUrl.replaceAll("/+$", "");

        String url = String.format("%s/%s/route_adv/driving/%f,%f;%f,%f?steps=false",
                baseUrl, apiKey, originLon, originLat, destLon, destLat);

        HttpHeaders headers = new HttpHeaders();
        String serverIp = appProperties.getMapplsServerIp();
        if (serverIp != null && !serverIp.isBlank()) {
            headers.set("X-Forwarded-For", serverIp.trim());
            headers.set("Client-IP", serverIp.trim());
        }

        HttpEntity<Void> requestEntity = new HttpEntity<>(headers);
        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, requestEntity, Map.class);
        Map<String, Object> body = response.getBody();

        if (body == null) {
            throw new IllegalStateException("Empty response from MapMyIndia (Mappls)");
        }

        List<Map<String, Object>> routes = (List<Map<String, Object>>) body.get("routes");
        if (routes == null || routes.isEmpty()) {
            throw new IllegalStateException("No routes found in MapMyIndia response");
        }

        Map<String, Object> firstRoute = routes.get(0);
        double durationSeconds;
        double distanceMeters;

        if (firstRoute.containsKey("duration")) {
            durationSeconds = ((Number) firstRoute.get("duration")).doubleValue();
            distanceMeters = ((Number) firstRoute.get("distance")).doubleValue();
        } else if (firstRoute.containsKey("summary")) {
            Map<String, Object> summary = (Map<String, Object>) firstRoute.get("summary");
            durationSeconds = ((Number) summary.get("travelTimeInSeconds")).doubleValue();
            distanceMeters = ((Number) summary.get("lengthInMeters")).doubleValue();
        } else {
            throw new IllegalStateException("Unrecognized route summary structure in MapMyIndia response");
        }

        double distanceKm = distanceMeters / 1000.0;
        double baseMinutes = durationSeconds / 60.0;
        int exactMinutes = Math.max(1, (int) Math.round(baseMinutes));

        return new TravelRangeDto(distanceKm, baseMinutes, exactMinutes, exactMinutes, true);
    }

    private TravelRangeDto fallback(double hospitalLat, double hospitalLon, double patientLat, double patientLon) {
        double distanceKm = geoDistanceService.distanceKm(hospitalLat, hospitalLon, patientLat, patientLon);
        double baseMinutes = geoDistanceService.estimatedTravelMinutes(distanceKm);
        int exactMinutes = Math.max(1, (int) Math.round(baseMinutes));
        return new TravelRangeDto(distanceKm, baseMinutes, exactMinutes, exactMinutes, false);
    }
}
