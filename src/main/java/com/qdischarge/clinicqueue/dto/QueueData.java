package com.qdischarge.clinicqueue.dto;

import java.util.List;

/** Mirrors the object returned by queueManager.js#getQueue(). */
public record QueueData(List<TokenDto> tokens, Integer currentServing, Stats stats) {
}
