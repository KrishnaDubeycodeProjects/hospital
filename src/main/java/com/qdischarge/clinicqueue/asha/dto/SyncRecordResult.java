package com.qdischarge.clinicqueue.asha.dto;

/**
 * Per-record acknowledgement returned by {@code POST /api/sync/upload} (sync contract v2).
 *
 * @param outboxId   the client outbox item this record came from (echoed back verbatim)
 * @param clientUuid the client-side UUID of the entity (family / member / survey / task / meeting)
 * @param entity     FAMILY | MEMBER | SURVEY | FOLLOW_UP | MEETING | DELETE_FAMILY | DELETE_MEMBER
 * @param serverId   database id the record is bound to (null when rejected or not on server)
 * @param status     ACCEPTED | REJECTED
 * @param reason     machine-readable reason code (null when plainly accepted)
 * @param retryable  true when a REJECTED record may succeed later (e.g. its parent family
 *                   has not been uploaded yet); false for validation/ownership failures
 */
public record SyncRecordResult(
        String outboxId,
        String clientUuid,
        String entity,
        Integer serverId,
        String status,
        String reason,
        boolean retryable
) {
    public static final String ACCEPTED = "ACCEPTED";
    public static final String REJECTED = "REJECTED";

    public static SyncRecordResult accepted(String outboxId, String clientUuid, String entity, Integer serverId, String reason) {
        return new SyncRecordResult(outboxId, clientUuid, entity, serverId, ACCEPTED, reason, false);
    }

    public static SyncRecordResult rejected(String outboxId, String clientUuid, String entity, String reason, boolean retryable) {
        return new SyncRecordResult(outboxId, clientUuid, entity, null, REJECTED, reason, retryable);
    }
}
