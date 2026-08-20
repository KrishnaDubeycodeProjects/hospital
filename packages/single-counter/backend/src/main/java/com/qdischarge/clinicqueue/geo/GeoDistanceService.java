package com.qdischarge.clinicqueue.geo;

import com.qdischarge.clinicqueue.config.AppProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Distance-aware queue math: how far a patient is from the hospital, how
 * long that takes to travel, how many tokens' worth of head-start their
 * "get ready" notification needs, and how big a token-count arrival window
 * that buys them. Implements the "Distance-Based Notification" and
 * "Priority Window" formulas from the product spec.
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

    /**
     * Dynamic notification range: how many tokens before their turn a patient
     * should be pinged, scaled by how long they need to travel. Nearby patients
     * get a small heads-up (clamped at the configured minimum, e.g. 2 tokens);
     * distant patients get a much bigger one (clamped at the configured
     * maximum, e.g. 12 tokens) instead of a single fixed number for everyone.
     */
    public int notifyTokensAhead(double travelMinutes) {
        double avgServiceMinutes = Math.max(1, appProperties.getAvgServiceMinutes());
        long raw = Math.round(Math.ceil(travelMinutes / avgServiceMinutes));
        int min = appProperties.getNotifyMinTokens();
        int max = appProperties.getNotifyMaxTokens();
        return (int) Math.max(min, Math.min(raw, max));
    }

    /**
     * Priority Window = Notification Tokens x Active Counters -- the number of
     * queue slots a patient's arrival window spans once notified. With more
     * counters serving in parallel, the queue burns through tokens faster, so
     * a given travel time buys proportionally fewer "wall clock" tokens of
     * grace unless the window is scaled up by counter count.
     */
    public int priorityWindow(int notifyTokensAhead, int activeCounters) {
        return notifyTokensAhead * Math.max(1, activeCounters);
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
