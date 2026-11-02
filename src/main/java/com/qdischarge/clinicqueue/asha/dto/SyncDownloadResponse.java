package com.qdischarge.clinicqueue.asha.dto;

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
    private List<Integer> deletedFamilyIds;
    private List<Integer> deletedMemberIds;

    /** Client UUIDs of soft-deleted families / members (sync contract v2). */
    private List<String> deletedFamilyClientUuids;
    private List<String> deletedMemberClientUuids;

    /** ISO-8601 timestamp for the next sync's ?since= parameter */
    private String serverTimestamp;
}
