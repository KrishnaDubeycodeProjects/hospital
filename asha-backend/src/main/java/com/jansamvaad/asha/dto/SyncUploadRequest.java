package com.jansamvaad.asha.dto;

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
}
