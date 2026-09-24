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
import java.util.Locale;
import java.util.Map;

/**
 * Travel-time and distance estimation using TomTom / MapMyIndia (Mappls) Routing APIs.
 * Includes comprehensive Anomaly / Contrast Guard to prevent abrupt or wildly contrasting
 * distance and duration outputs caused by:
 * - Flipped / inverted coordinates (lat/lon vs lon/lat)
 * - Road detours violating physical triangle inequality or exceeding reasonable circuity
 * - Speed / duration outliers (slower than walking or faster than highway limits)
 *
 * Falls back to calibrated straight-line Haversine math with urban road circuity (1.25x)
 * if credentials are missing or external requests fail.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MapMyIndiaRoutingService {

    private final AppProperties appProperties;
    private final RestTemplate restTemplate;
    private final GeoDistanceService geoDistanceService;

    public record LatLonPair(double lat, double lon) {}

    /**
     * Estimates travel duration and returns sanitized distance and duration.
     * hospitalLat/hospitalLon = destination, patientLat/patientLon = origin.
     */
    public TravelRangeDto estimate(double hospitalLat, double hospitalLon, double patientLat, double patientLon) {
        LatLonPair normDest = normalizeCoordinates(hospitalLat, hospitalLon);
        LatLonPair normOrig = normalizeCoordinates(patientLat, patientLon);

        double straightLineKm = geoDistanceService.distanceKm(normDest.lat(), normDest.lon(), normOrig.lat(), normOrig.lon());
        double avgSpeed = appProperties.getGeoAvgSpeedKmh() > 0 ? appProperties.getGeoAvgSpeedKmh() : 25.0;

        // 1. Extreme proximity check (patient is practically inside or in front of the hospital)
        if (straightLineKm < 0.05) {
            return new TravelRangeDto(0.05, 1.0, 1, 1, false);
        }

        // 2. Try TomTom Routing API first if configured
        String tomtomKey = appProperties.getTomtomApiKey();
        if (tomtomKey != null && !tomtomKey.isBlank()) {
            try {
                TravelRangeDto tomtomResult = callTomTom(tomtomKey, normOrig.lat(), normOrig.lon(), normDest.lat(), normDest.lon(), straightLineKm, avgSpeed);
                if (tomtomResult != null) {
                    return tomtomResult;
                }
            } catch (Exception e) {
                log.warn("⚠️ TomTom routing error ({}) -- attempting next routing provider.", e.getMessage());
            }
        }

        // 3. Try MapMyIndia (Mappls) Routing API if configured
        String mapplsKey = appProperties.getMapplsApiKey();
        if (mapplsKey != null && !mapplsKey.isBlank()) {
            try {
                TravelRangeDto mapplsResult = callMappls(mapplsKey, normOrig.lat(), normOrig.lon(), normDest.lat(), normDest.lon(), straightLineKm, avgSpeed);
                if (mapplsResult != null) {
                    return mapplsResult;
                }
            } catch (Exception e) {
                log.warn("⚠️ MapMyIndia (Mappls) routing error ({}) -- falling back to calibrated straight-line estimate.", e.getMessage());
            }
        }

        // 4. Calibrated Fallback (Haversine straight-line * 1.25 road circuity factor)
        return fallback(straightLineKm, avgSpeed);
    }

    @SuppressWarnings("unchecked")
    private TravelRangeDto callTomTom(String apiKey, double originLat, double originLon, double destLat, double destLon,
                                      double straightLineKm, double avgSpeed) {
        String url = String.format(Locale.US,
                "https://api.tomtom.com/routing/1/calculateRoute/%f,%f:%f,%f/json?key=%s&traffic=true",
                originLat, originLon, destLat, destLon, apiKey);

        Map<String, Object> body = restTemplate.getForObject(url, Map.class);
        if (body == null) {
            throw new IllegalStateException("Empty response from TomTom");
        }

        List<Map<String, Object>> routes = (List<Map<String, Object>>) body.get("routes");
        if (routes == null || routes.isEmpty()) {
            throw new IllegalStateException("No routes in TomTom response");
        }

        Map<String, Object> firstRoute = routes.get(0);
        Map<String, Object> summary = (Map<String, Object>) firstRoute.get("summary");
        if (summary == null) {
            throw new IllegalStateException("No summary found in TomTom route");
        }

        double lengthMeters = ((Number) summary.get("lengthInMeters")).doubleValue();
        double travelTimeSeconds = ((Number) summary.get("travelTimeInSeconds")).doubleValue();

        double rawDistanceKm = lengthMeters / 1000.0;
        double rawMinutes = travelTimeSeconds / 60.0;

        return sanitizeAndClamp(rawDistanceKm, rawMinutes, straightLineKm, avgSpeed, true);
    }

    @SuppressWarnings("unchecked")
    private TravelRangeDto callMappls(String apiKey, double originLat, double originLon, double destLat, double destLon,
                                      double straightLineKm, double avgSpeed) {
        String baseUrl = appProperties.getMapplsBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "https://apis.mappls.com/advancedmaps/v1";
        }
        baseUrl = baseUrl.replaceAll("/+$", "");

        String url = String.format(Locale.US, "%s/%s/route_adv/driving/%f,%f;%f,%f?steps=false",
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

        double rawDistanceKm = distanceMeters / 1000.0;
        double rawMinutes = durationSeconds / 60.0;

        return sanitizeAndClamp(rawDistanceKm, rawMinutes, straightLineKm, avgSpeed, true);
    }

    /**
     * Sanity & Contrast Guard:
     * Validates that the routing engine output is physically consistent with earth geometry
     * and normal traffic expectations. Clamps any abrupt or contrasting anomalies.
     */
    public TravelRangeDto sanitizeAndClamp(double rawDistanceKm, double rawMinutes,
                                           double straightLineKm, double avgSpeedKmh, boolean fromApi) {
        if (straightLineKm < 0.05) {
            return new TravelRangeDto(0.05, 1.0, 1, 1, fromApi);
        }

        double sanitizedDistance = rawDistanceKm;
        double sanitizedMinutes = rawMinutes;
        boolean contrastAnomaly = false;

        // 1. Geometric consistency check:
        // Road distance cannot be less than 0.85x straight line (triangle inequality)
        // Road distance should not exceed 3.0x straight line (or straight line + 5 km for short trips)
        double minAllowedDistance = straightLineKm * 0.85;
        double maxAllowedDistance = Math.max(straightLineKm * 3.0, straightLineKm + 5.0);

        if (rawDistanceKm < minAllowedDistance || rawDistanceKm > maxAllowedDistance || rawDistanceKm > 1000.0) {
            log.warn("⚠️ Abrupt distance output detected: rawRoadKm={} vs straightLineKm={}. Clamping to realistic road detour multiplier (1.25x).",
                    rawDistanceKm, straightLineKm);
            sanitizedDistance = Math.max(0.1, straightLineKm * 1.25);
            contrastAnomaly = true;
        }

        // 2. Speed / Travel Duration consistency check:
        double impliedSpeedKmh = (sanitizedMinutes > 0) ? (sanitizedDistance / (sanitizedMinutes / 60.0)) : 0;
        if (contrastAnomaly || sanitizedMinutes <= 0 || impliedSpeedKmh < 4.0 || impliedSpeedKmh > 110.0) {
            log.warn("⚠️ Abrupt travel duration detected: rawMinutes={}, impliedSpeedKmh={}. Calibrating using avgSpeedKmh={}.",
                    rawMinutes, impliedSpeedKmh, avgSpeedKmh);
            double safeSpeed = (avgSpeedKmh > 0) ? avgSpeedKmh : 25.0;
            sanitizedMinutes = (sanitizedDistance / safeSpeed) * 60.0;
            contrastAnomaly = true;
        }

        int exactMinutes = Math.max(1, (int) Math.round(sanitizedMinutes));
        return new TravelRangeDto(
                Math.round(sanitizedDistance * 100.0) / 100.0,
                Math.round(sanitizedMinutes * 10.0) / 10.0,
                exactMinutes,
                exactMinutes,
                fromApi && !contrastAnomaly
        );
    }

    /**
     * Normalizes coordinates and detects inadvertently swapped lat/lon pairs.
     */
    public LatLonPair normalizeCoordinates(double lat, double lon) {
        // Detect inverted latitude/longitude (e.g., longitude passed in latitude parameter in India/South Asia)
        if (Math.abs(lat) > 40.0 && Math.abs(lon) <= 40.0) {
            log.warn("🔄 Inverted coordinates detected: lat={}, lon={}. Auto-correcting to lat={}, lon={}.",
                    lat, lon, lon, lat);
            return new LatLonPair(lon, lat);
        }
        return new LatLonPair(lat, lon);
    }

    private TravelRangeDto fallback(double straightLineKm, double avgSpeed) {
        // Calibrated realistic road distance = straight line * 1.25
        double estimatedRoadKm = Math.max(0.05, straightLineKm * 1.25);
        double safeSpeed = (avgSpeed > 0) ? avgSpeed : 25.0;
        double baseMinutes = Math.max(1.0, (estimatedRoadKm / safeSpeed) * 60.0);
        int exactMinutes = Math.max(1, (int) Math.round(baseMinutes));
        return new TravelRangeDto(
                Math.round(estimatedRoadKm * 100.0) / 100.0,
                Math.round(baseMinutes * 10.0) / 10.0,
                exactMinutes,
                exactMinutes,
                false
        );
    }
}
