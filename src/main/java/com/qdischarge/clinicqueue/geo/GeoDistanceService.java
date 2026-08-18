package com.qdischarge.clinicqueue.geo;

import com.qdischarge.clinicqueue.config.AppProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Distance-aware queue math: how far a patient is from the hospital and how
 * long that takes to travel. Straight-line-only -- no roads/traffic -- so
 * it's used for two narrow, tolerant-of-approximation jobs: the
 * pre-registration "can you make it before closing?" check
 * (checkClosingTime), and as geo.TomTomRoutingService's fallback when a
 * real routing ETA isn't available. The precise, minutes-based "go now"
 * trigger patients are actually notified/called against lives in
 * geo.TomTomRoutingService + service.QueueManagerService#runTreatmentTimingTick.
 */
@Service
@RequiredArgsConstructor
public class GeoDistanceService {

    private final AppProperties appProperties;

    private static final double EARTH_RADIUS_KM = 6371.0;

    /** Great-circle distance between two points, in kilometers. */
    public double distanceKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_KM * c;
    }

    /** Straight-line-distance-based travel time estimate, in minutes (no live traffic/routing API involved). */
    public double estimatedTravelMinutes(double distanceKm) {
        double speedKmh = Math.max(1, appProperties.getGeoAvgSpeedKmh());
        return (distanceKm / speedKmh) * 60.0;
    }

    public record ArrivalFeasibility(boolean canMakeIt, double distanceKm, double travelMinutes, double minutesUntilClose) {
    }

    /** Can the patient realistically reach the hospital before OPD closes? */
    public ArrivalFeasibility checkClosingTime(double distanceKm, double travelMinutes, double minutesUntilClose) {
        // A little slack for parking/walking in, not just door-to-door driving time.
        boolean canMakeIt = travelMinutes + 5 <= minutesUntilClose;
        return new ArrivalFeasibility(canMakeIt, distanceKm, travelMinutes, minutesUntilClose);
    }
}
