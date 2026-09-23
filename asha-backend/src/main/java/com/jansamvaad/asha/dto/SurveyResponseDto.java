package com.jansamvaad.asha.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SurveyResponseDto {
    private Integer id;
    private Integer familyUnitId;
    private Integer familyMemberId;
    private Integer templateId;
    private String categoryCode;
    private String ashaWorkerPhone;

    /** The filled answers as JSONB — {qid: selectedValue, ...} */
    private Map<String, Object> answers;

    private Boolean syncedToAnm;
    private String targetAnmPhone;
    private LocalDateTime syncedAt;
    private String offlineId;
    private LocalDateTime createdAt;

    // Joined context for display
    private String memberName;
    private String familyHeadName;
}
