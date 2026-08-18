package com.qdischarge.clinicqueue.geo;

import org.springframework.stereotype.Service;

/**
 * Java port of India Post's official DIGIPIN encoder/decoder
 * (github.com/INDIAPOST-gov/digipin, src/digipin.js) -- same 4x4 grid,
 * bounding box, and per-level narrowing logic, character-for-character.
 *
 * DIGIPIN divides India's bounding box (lat 2.5-38.5N, lon 63.5-99.5E) into
 * a 4x4 grid recursively for 10 levels, giving ~4m x 4m resolution. Every
 * hospital and every patient location in this system is addressable as a
 * single 10-character DIGIPIN, independent of street addresses or postal
 * codes -- which is the point of using it here: a hospital's "location" is
 * just its DIGIPIN (settable manually or derived from lat/lon), and a
 * patient's current location is encoded the same way for distance math.
 */
@Service
public class DigipinService {

    private static final char[][] GRID = {
            {'F', 'C', '9', '8'},
            {'J', '3', '2', '7'},
            {'K', '4', '5', '6'},
            {'L', 'M', 'P', 'T'},
    };

    private static final double MIN_LAT = 2.5;
    private static final double MAX_LAT = 38.5;
    private static final double MIN_LON = 63.5;
    private static final double MAX_LON = 99.5;

    private static final java.util.regex.Pattern VALID_CHARS =
            java.util.regex.Pattern.compile("^[23456789CJKLMPFT]{10}$");

    /** Encodes a lat/lon pair (must fall within India's bounding box) into a 10-char DIGIPIN. */
    public String encode(double lat, double lon) {
        if (lat < MIN_LAT || lat > MAX_LAT) {
            throw new IllegalArgumentException("Latitude out of DIGIPIN range (" + MIN_LAT + " to " + MAX_LAT + ")");
        }
        if (lon < MIN_LON || lon > MAX_LON) {
            throw new IllegalArgumentException("Longitude out of DIGIPIN range (" + MIN_LON + " to " + MAX_LON + ")");
        }

        double minLat = MIN_LAT, maxLat = MAX_LAT, minLon = MIN_LON, maxLon = MAX_LON;
        StringBuilder pin = new StringBuilder(10);

        for (int level = 1; level <= 10; level++) {
            double latDiv = (maxLat - minLat) / 4;
            double lonDiv = (maxLon - minLon) / 4;

            // Rows run north-to-south (row 0 = northernmost quarter), matching the reference impl.
            int row = clamp(3 - (int) Math.floor((lat - minLat) / latDiv));
            int col = clamp((int) Math.floor((lon - minLon) / lonDiv));

            pin.append(GRID[row][col]);

            double newMaxLat = minLat + latDiv * (4 - row);
            double newMinLat = minLat + latDiv * (3 - row);
            maxLat = newMaxLat;
            minLat = newMinLat;

            double newMinLon = minLon + lonDiv * col;
            double newMaxLon = newMinLon + lonDiv;
            minLon = newMinLon;
            maxLon = newMaxLon;
        }

        return pin.toString();
    }

    private int clamp(int v) {
        return Math.max(0, Math.min(v, 3));
    }

    /** Decodes a 10-char DIGIPIN back to its cell's center lat/lon. */
    public LatLon decode(String digipin) {
        if (digipin == null) {
            throw new IllegalArgumentException("DIGIPIN must not be null.");
        }
        String pin = digipin.trim().toUpperCase();
        if (pin.length() != 10) {
            throw new IllegalArgumentException("DIGIPIN must be exactly 10 characters.");
        }
        if (!VALID_CHARS.matcher(pin).matches()) {
            throw new IllegalArgumentException(
                    "Invalid DIGIPIN. Only 2,3,4,5,6,7,8,9,C,J,K,L,M,P,F,T are permitted, no separators.");
        }

        double minLat = MIN_LAT, maxLat = MAX_LAT, minLon = MIN_LON, maxLon = MAX_LON;

        for (int i = 0; i < 10; i++) {
            char c = pin.charAt(i);
            int ri = -1, ci = -1;
            outer:
            for (int r = 0; r < 4; r++) {
                for (int cc = 0; cc < 4; cc++) {
                    if (GRID[r][cc] == c) {
                        ri = r;
                        ci = cc;
                        break outer;
                    }
                }
            }
            if (ri < 0) {
                throw new IllegalArgumentException("Invalid character in DIGIPIN: " + c);
            }

            double latDiv = (maxLat - minLat) / 4;
            double lonDiv = (maxLon - minLon) / 4;

            double lat1 = maxLat - latDiv * (ri + 1);
            double lat2 = maxLat - latDiv * ri;
            double lon1 = minLon + lonDiv * ci;
            double lon2 = minLon + lonDiv * (ci + 1);

            minLat = lat1;
            maxLat = lat2;
            minLon = lon1;
            maxLon = lon2;
        }

        double centerLat = (minLat + maxLat) / 2;
        double centerLon = (minLon + maxLon) / 2;
        return new LatLon(round6(centerLat), round6(centerLon));
    }

    private double round6(double v) {
        return Math.round(v * 1_000_000.0) / 1_000_000.0;
    }

    /** Cosmetic "XXX-XXX-XXXX" grouping for display only; encode()/decode() always use the plain 10-char form. */
    public String format(String rawDigipin) {
        if (rawDigipin == null || rawDigipin.length() != 10) {
            return rawDigipin;
        }
        return rawDigipin.substring(0, 3) + "-" + rawDigipin.substring(3, 6) + "-" + rawDigipin.substring(6, 10);
    }

    public record LatLon(double lat, double lon) {
    }
}
