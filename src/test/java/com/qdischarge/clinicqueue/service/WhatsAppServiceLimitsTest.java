package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.WaButton;
import com.qdischarge.clinicqueue.dto.WaListRow;
import com.qdischarge.clinicqueue.dto.WaListSection;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Meta rejects interactive payloads that exceed its limits, which silently downgraded the bot to
 * plain text without buttons. These tests pin every limit the service now enforces.
 */
class WhatsAppServiceLimitsTest {

    private RestTemplate rest;
    private WhatsAppService service;

    @BeforeEach
    void setUp() {
        rest = mock(RestTemplate.class);
        when(rest.postForEntity(anyString(), any(), eq(Map.class))).thenReturn(ResponseEntity.ok(Map.of()));
        AppProperties props = new AppProperties();
        // Run tasks inline so assertions see the dispatched payload.
        service = new WhatsAppService(rest, props, Runnable::run);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> lastInteractive() {
        ArgumentCaptor<HttpEntity> captor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(rest, atLeastOnce()).postForEntity(anyString(), captor.capture(), eq(Map.class));
        Map<String, Object> body = (Map<String, Object>) captor.getValue().getBody();
        return (Map<String, Object>) body.get("interactive");
    }

    @Test
    void clipNeverSplitsSurrogatePairs() {
        String s = "🏥🏥🏥🏥";
        assertThat(WhatsAppService.clip(s, 2)).isEqualTo("🏥🏥");
        assertThat(WhatsAppService.clip("अस्पताल चुनें", 50)).isEqualTo("अस्पताल चुनें");
    }

    @Test
    @SuppressWarnings("unchecked")
    void listIsCappedAtTenRowsAcrossSectionsWithUniqueIds() {
        List<WaListRow> a = new ArrayList<>();
        List<WaListRow> b = new ArrayList<>();
        for (int i = 0; i < 8; i++) a.add(new WaListRow("hosp_" + i, "Hospital number " + i + " very long name here", "d".repeat(100)));
        for (int i = 0; i < 8; i++) b.add(new WaListRow("hosp_" + i, "dup", null)); // duplicate ids
        b.add(new WaListRow("extra_1", "Extra", null));
        b.add(new WaListRow("extra_2", "Extra 2", null));
        b.add(new WaListRow("extra_3", "Extra 3", null));

        service.sendListMessage("9876543210", "H".repeat(80), "B".repeat(2000),
                List.of(new WaListSection("A section title that is far too long", a), new WaListSection("Second", b)),
                null, "A button label that is too long");

        Map<String, Object> interactive = lastInteractive();
        Map<String, Object> action = (Map<String, Object>) interactive.get("action");
        List<Map<String, Object>> sections = (List<Map<String, Object>>) action.get("sections");
        int rows = 0;
        java.util.Set<Object> ids = new java.util.HashSet<>();
        for (Map<String, Object> sec : sections) {
            assertThat(((String) sec.get("title")).length()).isLessThanOrEqualTo(24);
            for (Map<String, Object> row : (List<Map<String, Object>>) sec.get("rows")) {
                rows++;
                assertThat(ids.add(row.get("id"))).isTrue();
                assertThat(((String) row.get("title")).length()).isLessThanOrEqualTo(24);
                if (row.get("description") != null) assertThat(((String) row.get("description")).length()).isLessThanOrEqualTo(72);
            }
        }
        assertThat(rows).isEqualTo(10);
        assertThat(((String) action.get("button")).length()).isLessThanOrEqualTo(20);
        assertThat(((String) ((Map<String, Object>) interactive.get("header")).get("text")).length()).isLessThanOrEqualTo(60);
        assertThat(((String) ((Map<String, Object>) interactive.get("body")).get("text")).length()).isLessThanOrEqualTo(1024);
    }

    @Test
    @SuppressWarnings("unchecked")
    void buttonsAreCappedDedupedAndTrimmed() {
        service.sendButtonsMessage("9876543210", "", "Pick", List.of(
                new WaButton("a", "Same title for both"),
                new WaButton("b", "Same title for both"),
                new WaButton("c", "Third"),
                new WaButton("d", "Fourth"),
                new WaButton("e", "Fifth")), "F".repeat(90));

        Map<String, Object> interactive = lastInteractive();
        assertThat(interactive).doesNotContainKey("header");
        List<Map<String, Object>> buttons = (List<Map<String, Object>>) ((Map<String, Object>) interactive.get("action")).get("buttons");
        assertThat(buttons).hasSize(3);
        assertThat(buttons).extracting(btn -> ((Map<String, Object>) btn.get("reply")).get("id")).containsExactly("a", "c", "d");
        assertThat(((String) ((Map<String, Object>) interactive.get("footer")).get("text")).length()).isLessThanOrEqualTo(60);
    }

    @Test
    void validationErrorsAreNotRetried() {
        reset(rest);
        when(rest.postForEntity(anyString(), any(), eq(Map.class)))
                .thenThrow(HttpClientErrorException.create(HttpStatus.BAD_REQUEST, "Bad Request", HttpHeaders.EMPTY,
                        "{\"error\":{\"code\":131009}}".getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8));

        service.sendButtonsMessage("9876543210", "T", "Body", List.of(new WaButton("a", "A")), null);

        // 1 interactive attempt (no retries on 400) + 1 text fallback attempt.
        verify(rest, times(2)).postForEntity(anyString(), any(), eq(Map.class));
    }
}
