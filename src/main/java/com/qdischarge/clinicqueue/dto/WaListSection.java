package com.qdischarge.clinicqueue.dto;

import java.util.List;

/** One titled group of rows in an interactive list message (WhatsAppService#sendListMessage). */
public record WaListSection(String title, List<WaListRow> rows) {
}
