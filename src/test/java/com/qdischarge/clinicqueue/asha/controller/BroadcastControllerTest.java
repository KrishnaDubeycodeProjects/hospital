package com.qdischarge.clinicqueue.asha.controller;

import com.qdischarge.clinicqueue.asha.dto.AshaWorkerDto;
import com.qdischarge.clinicqueue.asha.service.AshaWorkerService;
import com.qdischarge.clinicqueue.asha.service.BroadcastService;
import com.qdischarge.clinicqueue.asha.service.ChoReferralService;
import com.qdischarge.clinicqueue.security.CurrentUser;
import com.qdischarge.clinicqueue.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * NHM broadcast endpoints: who may send (CHO with a sector / ADMIN), input validation,
 * and that inbox / ack are restricted to ASHA & ANM and to broadcasts addressed to them.
 */
class BroadcastControllerTest {

    private static final String CHO = "9000000001";
    private static final String ASHA = "9000000002";
    private static final String ANM = "9000000003";

    private BroadcastService broadcasts;
    private ChoReferralService cho;
    private AshaWorkerService workers;
    private CurrentUser currentUser;
    private BroadcastController controller;

    @BeforeEach
    void setUp() {
        broadcasts = mock(BroadcastService.class);
        cho = mock(ChoReferralService.class);
        workers = mock(AshaWorkerService.class);
        currentUser = mock(CurrentUser.class);
        controller = new BroadcastController(broadcasts, cho, workers, currentUser);
    }

    private void loginAs(String role, String phone) {
        when(currentUser.get()).thenReturn(new JwtService.DecodedToken(phone, role, null));
        if (JwtService.CHO_ROLE.equals(role)) when(currentUser.getChoPhone()).thenReturn(phone);
        if (JwtService.ASHA_ROLE.equals(role) || JwtService.ANM_ROLE.equals(role)) when(currentUser.getAshaPhone()).thenReturn(phone);
    }

    private static Map<String, Object> body(Object... kv) {
        Map<String, Object> m = new HashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    private static Object error(ResponseEntity<?> res) {
        return ((Map<?, ?>) res.getBody()).get("error");
    }

    @Nested
    class Create {

        @Test
        void choWithSectorCreatesBroadcastWithDefaultsAndSenderName() {
            loginAs(JwtService.CHO_ROLE, CHO);
            when(cho.sectorSize(CHO)).thenReturn(4);
            when(workers.getProfileForMe(CHO, JwtService.CHO_ROLE))
                    .thenReturn(Optional.of(AshaWorkerDto.builder().name("Dr. Meena").build()));
            when(broadcasts.create(anyString(), anyString(), any(), any())).thenReturn(42);

            ResponseEntity<Map<String, Object>> res = controller.create(body(
                    "title", "  Pulse Polio  ", "message", "Booth duty Sunday", "dueDate", "2026-11-09"));

            assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            assertThat(res.getBody()).containsEntry("id", 42).containsEntry("success", true);
            ArgumentCaptor<BroadcastService.NewBroadcast> nb = ArgumentCaptor.forClass(BroadcastService.NewBroadcast.class);
            verify(broadcasts).create(eq(CHO), eq("CHO"), eq("Dr. Meena"), nb.capture());
            assertThat(nb.getValue().title()).isEqualTo("Pulse Polio"); // trimmed
            assertThat(nb.getValue().priority()).isEqualTo("NORMAL");   // default
            assertThat(nb.getValue().audience()).isEqualTo("ALL");      // default
            assertThat(nb.getValue().dueDate()).isEqualTo(LocalDate.of(2026, 11, 9));
        }

        @Test
        void priorityAndAudienceAreCaseInsensitive() {
            loginAs(JwtService.CHO_ROLE, CHO);
            when(cho.sectorSize(CHO)).thenReturn(1);
            when(workers.getProfileForMe(any(), any())).thenReturn(Optional.empty());

            controller.create(body("title", "T", "message", "M", "priority", "urgent", "audience", "anm"));

            ArgumentCaptor<BroadcastService.NewBroadcast> nb = ArgumentCaptor.forClass(BroadcastService.NewBroadcast.class);
            verify(broadcasts).create(eq(CHO), eq("CHO"), isNull(), nb.capture());
            assertThat(nb.getValue().priority()).isEqualTo("URGENT");
            assertThat(nb.getValue().audience()).isEqualTo("ANM");
        }

        @Test
        void adminBroadcastsUnderOwnSubjectWithoutSectorCheck() {
            loginAs(JwtService.ADMIN_ROLE, "nhm-admin");

            ResponseEntity<Map<String, Object>> res = controller.create(body("title", "T", "message", "M"));

            assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            verify(broadcasts).create(eq("nhm-admin"), eq("ADMIN"), isNull(), any());
            verifyNoInteractions(cho);
        }

        @Test
        void choWithoutSectorIsForbidden() {
            loginAs(JwtService.CHO_ROLE, CHO);
            when(cho.sectorSize(CHO)).thenReturn(0);

            ResponseEntity<Map<String, Object>> res = controller.create(body("title", "T", "message", "M"));

            assertThat(res.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
            assertThat(error(res)).isEqualTo("NO_SECTOR");
            verify(broadcasts, never()).create(any(), any(), any(), any());
        }

        @Test
        void unauthenticatedCallerIsRejected() {
            ResponseEntity<Map<String, Object>> res = controller.create(body("title", "T", "message", "M"));
            assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(error(res)).isEqualTo("UNIDENTIFIED_CALLER");
        }

        @Test
        void choTokenWithoutPhoneIsRejected() {
            when(currentUser.get()).thenReturn(new JwtService.DecodedToken("x", JwtService.CHO_ROLE, null));
            when(currentUser.getChoPhone()).thenReturn(" ");

            ResponseEntity<Map<String, Object>> res = controller.create(body("title", "T", "message", "M"));

            assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }

        @Test
        void validationErrors() {
            loginAs(JwtService.ADMIN_ROLE, "nhm-admin");

            assertThat(error(controller.create(body("title", "", "message", "M")))).isEqualTo("TITLE_AND_MESSAGE_REQUIRED");
            assertThat(error(controller.create(body("title", "T", "message", "   ")))).isEqualTo("TITLE_AND_MESSAGE_REQUIRED");
            assertThat(error(controller.create(body("title", "x".repeat(121), "message", "M")))).isEqualTo("TOO_LONG");
            assertThat(error(controller.create(body("title", "T", "message", "x".repeat(2001))))).isEqualTo("TOO_LONG");
            assertThat(error(controller.create(body("title", "T", "message", "M", "priority", "LOW")))).isEqualTo("INVALID_PRIORITY_OR_AUDIENCE");
            assertThat(error(controller.create(body("title", "T", "message", "M", "audience", "PATIENT")))).isEqualTo("INVALID_PRIORITY_OR_AUDIENCE");
            assertThat(error(controller.create(body("title", "T", "message", "M", "dueDate", "09/11/2026")))).isEqualTo("INVALID_DUE_DATE");
            verify(broadcasts, never()).create(any(), any(), any(), any());
        }

        @Test
        void boundaryLengthsAreAccepted() {
            loginAs(JwtService.ADMIN_ROLE, "nhm-admin");
            ResponseEntity<Map<String, Object>> res = controller.create(body("title", "x".repeat(120), "message", "y".repeat(2000)));
            assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        }
    }

    @Nested
    class SentAndWithdraw {

        @Test
        void sentListsChoOwnBroadcasts() {
            loginAs(JwtService.CHO_ROLE, CHO);
            List<Map<String, Object>> rows = List.of(Map.of("id", 1, "readCount", 3, "doneCount", 1));
            when(broadcasts.sent(CHO)).thenReturn(rows);

            ResponseEntity<?> res = controller.sent();

            assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(res.getBody()).isEqualTo(rows);
        }

        @Test
        void adminSentUsesSubject() {
            loginAs(JwtService.ADMIN_ROLE, "nhm-admin");
            controller.sent();
            verify(broadcasts).sent("nhm-admin");
        }

        @Test
        void withdrawOwnBroadcast() {
            loginAs(JwtService.CHO_ROLE, CHO);
            when(broadcasts.withdraw(7, CHO)).thenReturn(true);
            assertThat(controller.withdraw(7).getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        @Test
        void withdrawSomeoneElsesBroadcastIsNotFound() {
            loginAs(JwtService.CHO_ROLE, CHO);
            when(broadcasts.withdraw(7, CHO)).thenReturn(false);
            ResponseEntity<Map<String, Object>> res = controller.withdraw(7);
            assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
            assertThat(error(res)).isEqualTo("NOT_FOUND");
        }

        @Test
        void unauthenticatedSentAndWithdrawAreRejected() {
            assertThat(controller.sent().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(controller.withdraw(1).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            verifyNoInteractions(broadcasts);
        }
    }

    @Nested
    class InboxAndAck {

        @Test
        void ashaSeesOwnInbox() {
            loginAs(JwtService.ASHA_ROLE, ASHA);
            controller.inbox();
            verify(broadcasts).inbox(ASHA, JwtService.ASHA_ROLE);
        }

        @Test
        void anmSeesOwnInbox() {
            loginAs(JwtService.ANM_ROLE, ANM);
            controller.inbox();
            verify(broadcasts).inbox(ANM, JwtService.ANM_ROLE);
        }

        @Test
        void choAndAdminCannotUseWorkerInbox() {
            loginAs(JwtService.CHO_ROLE, CHO);
            ResponseEntity<?> res = controller.inbox();
            assertThat(res.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
            assertThat(error(res)).isEqualTo("WORKERS_ONLY");

            loginAs(JwtService.ADMIN_ROLE, "nhm-admin");
            assertThat(controller.inbox().getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
            verify(broadcasts, never()).inbox(any(), any());
        }

        @Test
        void ackMarksReadByDefaultAndDoneWhenAsked() {
            loginAs(JwtService.ASHA_ROLE, ASHA);
            when(broadcasts.isAddressedTo(5, ASHA, JwtService.ASHA_ROLE)).thenReturn(true);

            assertThat(controller.ack(5, null).getStatusCode()).isEqualTo(HttpStatus.OK);
            verify(broadcasts).acknowledge(5, ASHA, false);

            controller.ack(5, body("done", true));
            verify(broadcasts).acknowledge(5, ASHA, true);

            controller.ack(5, body("done", "true")); // only a real boolean counts as done
            verify(broadcasts, times(2)).acknowledge(5, ASHA, false);
        }

        @Test
        void ackOnBroadcastNotAddressedToWorkerIsNotFound() {
            loginAs(JwtService.ANM_ROLE, ANM);
            when(broadcasts.isAddressedTo(5, ANM, JwtService.ANM_ROLE)).thenReturn(false);

            ResponseEntity<Map<String, Object>> res = controller.ack(5, body("done", true));

            assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
            verify(broadcasts, never()).acknowledge(anyInt(), any(), anyBoolean());
        }

        @Test
        void workerTokenWithoutPhoneIsForbidden() {
            when(currentUser.get()).thenReturn(new JwtService.DecodedToken("x", JwtService.ASHA_ROLE, null));
            when(currentUser.getAshaPhone()).thenReturn(null);
            assertThat(controller.inbox().getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
            assertThat(controller.ack(1, null).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        }
    }
}
