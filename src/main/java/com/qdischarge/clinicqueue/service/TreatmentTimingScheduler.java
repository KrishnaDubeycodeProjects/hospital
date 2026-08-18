package com.qdischarge.clinicqueue.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Thin timer trigger for the real-ETA "go now" notify/call and
 * anomaly-control expiry logic (see
 * QueueManagerService#runTreatmentTimingTick). Deliberately just a tick --
 * all the tokens-table SQL and business rules live in QueueManagerService,
 * same as every other queue rule in this app.
 *
 * A wall-clock timer (rather than the old "runs opportunistically on every
 * queue read" pattern -- see QueueManagerService class docs) is required
 * here: a notify/call has to fire, and an elapsed anomaly-control window has
 * to resolve, on its own deadline even if nobody happens to be polling the
 * API at that moment.
 *
 * The very first fixedDelay tick fires as soon as the scheduling
 * infrastructure comes up during context refresh -- which can race ahead of
 * HospitalSeedRunner (a plain ApplicationRunner that runs afterwards, on the
 * main thread) and query tables/columns that don't exist yet. Gate ticks on
 * ApplicationReadyEvent, which only fires once every runner has finished, so
 * ticks before that are skipped rather than erroring.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TreatmentTimingScheduler {

    private final QueueManagerService queueManagerService;

    private final AtomicBoolean ready = new AtomicBoolean(false);

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        ready.set(true);
    }

    @Scheduled(fixedDelayString = "${app.timing-poll-interval-ms:15000}")
    public void tick() {
        if (!ready.get()) {
            return;
        }
        queueManagerService.runTreatmentTimingTick();
    }
}
