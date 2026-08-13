package com.qdischarge.clinicqueue.dto;

/** Mirrors { token, nextServing } returned by queueManager.js#updateTokenStatus(). */
public record UpdateStatusResult(TokenDto token, Integer nextServing) {
}
