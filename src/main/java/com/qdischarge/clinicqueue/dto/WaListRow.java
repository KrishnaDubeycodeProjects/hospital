package com.qdischarge.clinicqueue.dto;

/** One tappable row in an interactive list message (WhatsAppService#sendListMessage). */
public record WaListRow(String id, String title, String description) {
}
