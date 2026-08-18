package com.qdischarge.clinicqueue.dto;

/** Mirrors { alreadyExists, data } returned by queueManager.js#createToken(). */
public record CreateTokenResult(boolean alreadyExists, TokenDto data) {
}
