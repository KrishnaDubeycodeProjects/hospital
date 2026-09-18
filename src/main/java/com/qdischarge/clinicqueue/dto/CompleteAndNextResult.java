package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Result returned upon completing a consultation in the Doctor Portal.
 * Contains finalized encounter details, any generated referral, and the next patient in line.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CompleteAndNextResult {
    private CourseEncounterDto encounter;
    private ReferralDto referral;
    private TokenDto completedToken;
    private TokenDto nextServingToken;
    private String message;
}
