package com.qdischarge.clinicqueue.asha.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Batch upload payload from the mobile app's offline sync queue.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyncUploadRequest {

    /** New/updated family units */
    private List<Map<String, Object>> families;

    /** New/updated family members */
    private List<Map<String, Object>> members;

    /** Filled survey responses with offline_id */
    private List<Map<String, Object>> surveys;

    /** Completed follow-up tasks with offline_id */
    private List<Map<String, Object>> followUps;

    /** ASHA meeting records (VHSNC / Gram Sabha) keyed by clientUuid */
    private List<Map<String, Object>> meetings;

    /**
     * Sync contract v2 tombstones: each entry carries outboxId, clientUuid, optional serverId
     * and (families) sequentialNumber, so deletes bind to the exact record.
     */
    private List<Map<String, Object>> deletedFamilies;
    private List<Map<String, Object>> deletedMembers;

    /** Legacy (v1): soft-deleted family unit IDs or sequential numbers */
    private List<Object> deletedFamilyIds;

    /** Legacy (v1): soft-deleted family member IDs */
    private List<Object> deletedMemberIds;
}
