package com.qdischarge.clinicqueue.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;

/**
 * A location given either as a DIGIPIN or as raw lat/lon -- used both for
 * "manually add/set a hospital's location" and for a patient sharing their
 * current or manually-entered location. Exactly one of the two forms must
 * be present; the service layer derives the other.
 */
public record SetLocationRequest(
        String digipin,
        @DecimalMin(value = "-90", message = "Latitude must be between -90 and 90.")
        @DecimalMax(value = "90", message = "Latitude must be between -90 and 90.")
        Double latitude,
        @DecimalMin(value = "-180", message = "Longitude must be between -180 and 180.")
        @DecimalMax(value = "180", message = "Longitude must be between -180 and 180.")
        Double longitude) {

    public boolean hasDigipin() {
        return digipin != null && !digipin.isBlank();
    }

    public boolean hasLatLon() {
        return latitude != null && longitude != null;
    }
}
