package com.qdischarge.clinicqueue.geo;

import com.qdischarge.clinicqueue.dto.TravelRangeDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Dedicated TomTom Routing Service adapter for direct injection / backward compatibility.
 * Delegates to MapMyIndiaRoutingService which hosts the full TomTom + Mappls + Contrast Guard engine.
 */
@Service
@RequiredArgsConstructor
public class TomTomRoutingService {

    private final MapMyIndiaRoutingService routingService;

    public record RouteEstimate(double distanceKm, double travelMinutes, boolean fromTomTom) {
    }

    public RouteEstimate estimate(double hospitalLat, double hospitalLon, double patientLat, double patientLon) {
        TravelRangeDto dto = routingService.estimate(hospitalLat, hospitalLon, patientLat, patientLon);
        return new RouteEstimate(dto.distanceKm(), dto.baseMinutes(), dto.fromMappls());
    }
}
