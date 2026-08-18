package com.qdischarge.clinicqueue.geo;

import com.qdischarge.clinicqueue.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

/**
 * Real (roads/traffic-aware) travel-time estimate from a patient's location
 * to the hospital, via TomTom's Routing API -- the "reaching time" the
 * treatment-timing trigger (see service.QueueManagerService#runTreatmentTimingTick)
 * compares against how much queue time is left. Called once, at
 * booking/location-set time (QueueManagerService#applyPatientLocation), not
 * re-polled per patient -- traffic conditions aren't re-estimated after
 * that, only the queue side of the comparison is.
 *
 * Falls back to {@link GeoDistanceService}'s straight-line haversine
 * estimate -- rather than failing the booking -- whenever no API key is
 * configured, or the TomTom call itself fails (network/outage/bad key):
 * this mirrors how the rest of this codebase treats third-party
 * integrations (see OtpService's Twilio dummy-credential fallback).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TomTomRoutingService {

    private final AppProperties appProperties;
    private final RestTemplate restTemplate;
    private final GeoDistanceService geoDistanceService;

    public record RouteEstimate(double distanceKm, double travelMinutes, boolean fromTomTom) {
    }

    /** hospitalLat/Lon = route destination, patientLat/Lon = route origin. */
    public RouteEstimate estimate(double hospitalLat, double hospitalLon, double patientLat, double patientLon) {
        String apiKey = appProperties.getTomtomApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            return fallback(hospitalLat, hospitalLon, patientLat, patientLon);
        }
        try {
            return callTomTom(apiKey, patientLat, patientLon, hospitalLat, hospitalLon);
        } catch (RuntimeException e) {
            log.error("❌ TomTom routing error ({}) -- falling back to straight-line estimate.", e.getMessage());
            return fallback(hospitalLat, hospitalLon, patientLat, patientLon);
        }
    }

    @SuppressWarnings("unchecked")
    private RouteEstimate callTomTom(String apiKey, double originLat, double originLon, double destLat, double destLon) {
        String url = "https://api.tomtom.com/routing/1/calculateRoute/%s,%s:%s,%s/json?key=%s&traffic=true"
                .formatted(originLat, originLon, destLat, destLon, apiKey);

        Map<String, Object> body = restTemplate.getForObject(url, Map.class);
        if (body == null) {
            throw new IllegalStateException("Empty response from TomTom");
        }
        List<Map<String, Object>> routes = (List<Map<String, Object>>) body.get("routes");
        if (routes == null || routes.isEmpty()) {
            throw new IllegalStateException("No routes in TomTom response");
        }
        Map<String, Object> summary = (Map<String, Object>) routes.get(0).get("summary");
        double lengthMeters = ((Number) summary.get("lengthInMeters")).doubleValue();
        double travelTimeSeconds = ((Number) summary.get("travelTimeInSeconds")).doubleValue();

        return new RouteEstimate(lengthMeters / 1000.0, travelTimeSeconds / 60.0, true);
    }

    private RouteEstimate fallback(double hospitalLat, double hospitalLon, double patientLat, double patientLon) {
        double distanceKm = geoDistanceService.distanceKm(hospitalLat, hospitalLon, patientLat, patientLon);
        double travelMinutes = geoDistanceService.estimatedTravelMinutes(distanceKm);
        return new RouteEstimate(distanceKm, travelMinutes, false);
    }
}
