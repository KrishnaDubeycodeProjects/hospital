package com.qdischarge.clinicqueue.dto;

public record TravelRangeDto(
        double distanceKm,
        double baseMinutes,
        int minMinutes,
        int maxMinutes,
        boolean fromMappls
) {
}
