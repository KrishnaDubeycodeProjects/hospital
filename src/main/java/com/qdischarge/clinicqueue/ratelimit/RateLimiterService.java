package com.qdischarge.clinicqueue.ratelimit;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory sliding-window rate limiter, keyed per (client IP, route).
 * Enforces a maximum capacity and automated eviction to prevent JVM memory exhaustion.
 */
@Service
public class RateLimiterService {

    private static final int MAX_ENTRIES = 50_000;
    private final ConcurrentHashMap<String, Deque<Instant>> windows = new ConcurrentHashMap<>();

    /** Returns true if the call is allowed under the given limit, recording it if so. */
    public boolean tryAcquire(String key, int maxRequests, Duration window) {
        Instant now = Instant.now();
        Instant cutoff = now.minus(window);

        // Guard against memory exhaustion by rejecting unbounded entry creation if max capacity reached
        if (windows.size() > MAX_ENTRIES && !windows.containsKey(key)) {
            evictExpired(cutoff);
            if (windows.size() > MAX_ENTRIES) {
                return false;
            }
        }

        Deque<Instant> timestamps = windows.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (timestamps) {
            while (!timestamps.isEmpty() && timestamps.peekFirst().isBefore(cutoff)) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= maxRequests) {
                return false;
            }
            timestamps.addLast(now);
            return true;
        }
    }

    /** Periodic scheduled maintenance to remove stale and empty rate limit windows */
    @Scheduled(fixedRate = 60000)
    public void cleanupStaleWindows() {
        evictExpired(Instant.now().minus(Duration.ofMinutes(2)));
    }

    private void evictExpired(Instant cutoff) {
        Iterator<Map.Entry<String, Deque<Instant>>> it = windows.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, Deque<Instant>> entry = it.next();
            Deque<Instant> deque = entry.getValue();
            synchronized (deque) {
                while (!deque.isEmpty() && deque.peekFirst().isBefore(cutoff)) {
                    deque.pollFirst();
                }
                if (deque.isEmpty()) {
                    it.remove();
                }
            }
        }
    }
}
