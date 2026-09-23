package com.qdischarge.clinicqueue.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Fast in-memory deduplication service for incoming WhatsApp webhook messages.
 * Prevents double-processing when Meta Cloud API retries webhooks on transient latency.
 */
@Service
@Slf4j
public class WebhookDeduplicationService {

    private static final long DEDUP_WINDOW_MS = 120_000L; // 2 minutes window

    private final ConcurrentHashMap<String, Long> processedMessages = new ConcurrentHashMap<>();

    /**
     * Checks if the message ID has already been processed within the sliding window.
     * If not seen, registers it and returns false.
     * If already seen, returns true.
     *
     * @param messageId Meta message ID (wamid)
     * @return true if duplicate, false if new message
     */
    public boolean isDuplicate(String messageId) {
        if (messageId == null || messageId.isBlank()) {
            return false;
        }

        long now = System.currentTimeMillis();
        Long previousTime = processedMessages.putIfAbsent(messageId, now);

        if (previousTime != null) {
            if (now - previousTime < DEDUP_WINDOW_MS) {
                return true;
            } else {
                processedMessages.put(messageId, now);
                return false;
            }
        }

        return false;
    }

    /**
     * Periodically cleans up expired message IDs every 5 minutes.
     */
    @Scheduled(fixedDelay = 300_000L, initialDelay = 60_000L)
    public void cleanupExpiredEntries() {
        long threshold = System.currentTimeMillis() - DEDUP_WINDOW_MS;
        int initialSize = processedMessages.size();
        processedMessages.entrySet().removeIf(entry -> entry.getValue() < threshold);
        int removed = initialSize - processedMessages.size();
        if (removed > 0) {
            log.debug("Cleaned up {} expired webhook message IDs from dedup cache", removed);
        }
    }
}
