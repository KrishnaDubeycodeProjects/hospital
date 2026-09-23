package com.jansamvaad.asha.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One circle in the heat map grid.
 * Contains just enough data to render a colored circle + navigate to family folder.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FamilyGridDto {
    private Integer id;
    private Integer sequentialNumber;
    private String headName;
    private String houseNumber;

    /** 7, 15, or 30 — determines the grid circle color */
    private Integer visitIntervalDays;

    /** Computed: today + visitIntervalDays from last_visited_at */
    private String nextVisitDate;

    /** GREEN, YELLOW, PINK, RED, GRAY */
    private String gridColor;

    private String lastVisitedAt;
    private int memberCount;

    /** Whether this family has data for the filtered section */
    private boolean hasPregnancyData;
    private boolean hasDiseaseData;
    private boolean hasChildData;
}
