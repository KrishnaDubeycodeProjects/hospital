package com.qdischarge.clinicqueue.event;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
@Slf4j
public class ConsultationEventListener {

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onConsultationCompleted(ConsultationCompletedEvent event) {
        log.info("Processing ConsultationCompletedEvent for course {}, patient {}", event.getCourseId(), event.getPatientPhone());
        if (event.getPatientPhone() == null || event.getPatientPhone().isBlank()) {
            return;
        }

        String phone = event.getPatientPhone();
        String frontendUrl = event.getFrontendUrl() != null ? event.getFrontendUrl() : "https://princete.com";

        // Proactive WhatsApp notifications from server removed (only respond when user initiates)
        log.info("Consultation completed for course {}. Outbound WhatsApp notifications suppressed (only user-initiated responses permitted).", event.getCourseId());
    }
}
