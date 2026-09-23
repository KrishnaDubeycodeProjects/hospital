package com.qdischarge.clinicqueue.dto;

import java.util.List;

/** Mirrors the object returned by queueManager.js#getQueue(), with multi-section support (waiting, reserved, missed, frozen). */
public record QueueData(
    List<TokenDto> tokens,
    Integer currentServing,
    Stats stats,
    List<TokenDto> reserved,
    List<TokenDto> missed,
    List<TokenDto> frozen
) {
    public QueueData(List<TokenDto> tokens, Integer currentServing, Stats stats) {
        this(tokens, currentServing, stats, List.of(), List.of(), List.of());
    }

    public QueueData(List<TokenDto> tokens, Integer currentServing, Stats stats, List<TokenDto> reserved, List<TokenDto> missed) {
        this(tokens, currentServing, stats, reserved, missed, List.of());
    }
}
