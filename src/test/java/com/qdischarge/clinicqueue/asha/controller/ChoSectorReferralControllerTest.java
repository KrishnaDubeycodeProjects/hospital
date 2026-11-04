package com.qdischarge.clinicqueue.asha.controller;

import com.qdischarge.clinicqueue.asha.service.ChoReferralService;
import com.qdischarge.clinicqueue.security.CurrentUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * CHO sector endpoints: worker details, sector referrals and referral approval must only work for an
 * identified CHO who has a sector, and approval must never touch a referral outside that sector.
 */
class ChoSectorReferralControllerTest {

    private static final String CHO = "9000000001";

    private ChoReferralService service;
    private CurrentUser currentUser;
    private ChoSectorReferralController controller;

    @BeforeEach
    void setUp() {
        service = mock(ChoReferralService.class);
        currentUser = mock(CurrentUser.class);
        controller = new ChoSectorReferralController(service, currentUser);
    }

    private void choWithSector(int size) {
        when(currentUser.getChoPhone()).thenReturn(CHO);
        when(service.sectorSize(CHO)).thenReturn(size);
    }

    private static Object error(ResponseEntity<?> res) {
        return ((Map<?, ?>) res.getBody()).get("error");
    }

    // ---------------- worker details ----------------

    @Test
    void sectorWorkersReturnsDetailsWithCounts() {
        choWithSector(2);
        List<Map<String, Object>> rows = List.of(
                Map.of("phone", "9000000002", "name", "Sunita", "role", "ASHA", "familyCount", 12, "surveyCount", 30,
                        "referralCount", 4, "pendingReferralCount", 1),
                Map.of("phone", "9000000003", "name", "Kavita", "role", "ANM", "familyCount", 0, "surveyCount", 0,
                        "referralCount", 0, "pendingReferralCount", 0));
        when(service.listSectorWorkers(CHO)).thenReturn(rows);

        ResponseEntity<?> res = controller.sectorWorkers();

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).isEqualTo(rows);
    }

    @Test
    void sectorWorkersWithoutSectorIsForbiddenNoSector() {
        choWithSector(0);
        ResponseEntity<?> res = controller.sectorWorkers();
        // The app maps exactly this 403 + NO_SECTOR to an empty worker list.
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(error(res)).isEqualTo("NO_SECTOR");
        verify(service, never()).listSectorWorkers(any());
    }

    // ---------------- worker activity ----------------

    @Test
    void workerActivityReturnsTrendAndRecentForSectorWorker() {
        when(currentUser.getChoPhone()).thenReturn(CHO);
        Map<String, Object> activity = Map.of(
                "daily", List.of(Map.of("date", "2026-11-04", "surveys", 3, "tasksDone", 1)),
                "recent", List.of(Map.of("kind", "SURVEY", "category", "PREGNANCY")));
        when(service.workerActivity(CHO, "9000000002")).thenReturn(activity);

        ResponseEntity<?> res = controller.workerActivity("9000000002");

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).isEqualTo(activity);
    }

    @Test
    void workerActivityOutsideSectorIsNotFound() {
        when(currentUser.getChoPhone()).thenReturn(CHO);
        when(service.workerActivity(CHO, "9111111111")).thenReturn(Map.of());

        ResponseEntity<?> res = controller.workerActivity("9111111111");

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(error(res)).isEqualTo("NOT_IN_SECTOR");
    }

    @Test
    void workerActivityRequiresIdentifiedCho() {
        when(currentUser.getChoPhone()).thenReturn(null);
        assertThat(controller.workerActivity("9000000002").getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(service, never()).workerActivity(any(), any());
    }

    @Test
    void unidentifiedCallerGets401OnEveryEndpoint() {
        when(currentUser.getChoPhone()).thenReturn(null);
        assertThat(controller.sectorWorkers().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(controller.sectorReferrals("all").getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(controller.approve(1, null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        when(currentUser.getChoPhone()).thenReturn("  ");
        assertThat(controller.sectorWorkers().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verifyNoInteractions(service);
    }

    // ---------------- sector referrals ----------------

    @Test
    void referralScopeDefaultsToAllAndPendingIsCaseInsensitive() {
        choWithSector(3);
        controller.sectorReferrals("all");
        verify(service).listSectorReferrals(CHO, false);

        controller.sectorReferrals("PENDING");
        verify(service).listSectorReferrals(CHO, true);

        controller.sectorReferrals("garbage");
        verify(service, times(2)).listSectorReferrals(CHO, false);
    }

    @Test
    void referralsWithoutSectorAreForbidden() {
        choWithSector(0);
        assertThat(error(controller.sectorReferrals("all"))).isEqualTo("NO_SECTOR");
        verify(service, never()).listSectorReferrals(any(), anyBoolean());
    }

    // ---------------- approval ----------------

    @Test
    void approveReferralInSector() {
        choWithSector(3);
        when(service.approve(CHO, 11, "Ambulance arranged")).thenReturn(ChoReferralService.ApproveOutcome.APPROVED);

        ResponseEntity<Map<String, Object>> res = controller.approve(11, Map.of("note", "Ambulance arranged"));

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody())
                .containsEntry("success", true)
                .containsEntry("id", 11)
                .containsEntry("status", "APPROVED_CHO")
                .containsEntry("alreadyApproved", false);
    }

    @Test
    void approveTwiceIsIdempotent() {
        choWithSector(3);
        when(service.approve(CHO, 11, null)).thenReturn(ChoReferralService.ApproveOutcome.ALREADY_APPROVED);

        ResponseEntity<Map<String, Object>> res = controller.approve(11, null);

        // Offline replays of the same approval must succeed, not error.
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).containsEntry("alreadyApproved", true);
    }

    @Test
    void approveOutsideSectorIsNotFound() {
        choWithSector(3);
        when(service.approve(CHO, 99, null)).thenReturn(ChoReferralService.ApproveOutcome.NOT_IN_SECTOR);

        ResponseEntity<Map<String, Object>> res = controller.approve(99, null);

        // 404 (not 403) so a CHO cannot probe which referral ids exist in other sectors.
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(error(res)).isEqualTo("NOT_IN_SECTOR");
    }

    @Test
    void approveWithoutSectorNeverCallsService() {
        choWithSector(0);
        assertThat(controller.approve(11, Map.of("note", "x")).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        verify(service, never()).approve(any(), anyInt(), any());
    }
}
