package com.jansamvaad.asha.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Delta download response — everything that changed since a given timestamp.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyncDownloadResponse {

    private List<FamilyDetailDto> families;
    private List<MemberDto> members;
    private List<SurveyTemplateDto> templates;
    private List<FollowUpTaskDto> followUps;

    /** ISO-8601 timestamp for the next sync's ?since= parameter */
    private String serverTimestamp;
}
