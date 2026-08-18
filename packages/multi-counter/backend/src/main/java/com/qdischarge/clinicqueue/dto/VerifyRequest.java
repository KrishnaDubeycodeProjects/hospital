package com.qdischarge.clinicqueue.dto;

/** Either qrData (raw QR payload -- object or string) or a direct tokenId may be supplied. */
public record VerifyRequest(Object qrData, Integer tokenId) {
}
