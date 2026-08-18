package com.qdischarge.clinicqueue.dto;

/** Mirrors the `stats` object literal returned by queueManager.js#getQueue(). */
public record Stats(int total, int waiting, int serving, int completed, int missed) {
}
