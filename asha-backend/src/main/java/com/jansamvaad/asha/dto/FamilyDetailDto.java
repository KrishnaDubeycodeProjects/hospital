package com.jansamvaad.asha.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Full family folder detail — shown when a family folder is opened.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FamilyDetailDto {
    private Integer id;
    private String primaryPhone;
    private String headName;
    private String villageName;
    private String houseNumber;
    private Integer sequentialNumber;
    private Integer visitIntervalDays;
    private LocalDate nextVisitDate;
    private LocalDateTime lastVisitedAt;
    private LocalDateTime createdAt;
    private List<MemberDto> members;
}
