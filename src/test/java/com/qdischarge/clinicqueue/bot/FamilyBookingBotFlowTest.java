package com.qdischarge.clinicqueue.bot;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.controller.WebhookController;
import com.qdischarge.clinicqueue.dto.FamilyMemberDto;
import com.qdischarge.clinicqueue.dto.TokenDto;
import com.qdischarge.clinicqueue.geo.GeoDistanceService;
import com.qdischarge.clinicqueue.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.ResponseEntity;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class FamilyBookingBotFlowTest {

    private QueueManagerService queueManagerService;
    private HospitalService hospitalService;
    private GeoDistanceService geoDistanceService;
    private WhatsAppService whatsAppService;
    private AppProperties appProperties;
    private WaSessionService waSessionService;
    private BotMessages botMessages;
    private AccessService accessService;
    private FamilyUnitService familyUnitService;
    private WebhookController webhookController;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        queueManagerService = mock(QueueManagerService.class);
        hospitalService = mock(HospitalService.class);
        geoDistanceService = mock(GeoDistanceService.class);
        whatsAppService = mock(WhatsAppService.class);
        appProperties = new AppProperties();
        appProperties.setClinicName("Arogya Clinic");
        waSessionService = mock(WaSessionService.class);
        botMessages = new BotMessages();
        accessService = mock(AccessService.class);
        familyUnitService = mock(FamilyUnitService.class);
        objectMapper = new ObjectMapper();

        webhookController = new WebhookController(
                queueManagerService,
                hospitalService,
                geoDistanceService,
                whatsAppService,
                appProperties,
                waSessionService,
                botMessages,
                accessService,
                familyUnitService
        );
    }

    private ObjectNode createMessagePayload(String phone, String text) {
        ObjectNode root = objectMapper.createObjectNode();
        ObjectNode data = root.putObject("data");
        ObjectNode key = data.putObject("key");
        key.put("remoteJid", phone + "@s.whatsapp.net");
        key.put("fromMe", false);
        data.put("pushName", "Ramesh");
        ObjectNode message = data.putObject("message");
        message.put("conversation", text);
        return root;
    }

    @Test
    void testFamilyBooking_Flow_ShowsFamilyMenuAndSelectsMember() {
        String phone = "+919876543210";

        // Setup session in English
        when(waSessionService.get(phone)).thenReturn(new WaSessionService.WaSession(phone, Lang.EN, "ready"));

        // Setup family unit with 2 members
        List<FamilyMemberDto> members = List.of(
                FamilyMemberDto.builder().id(1).name("Ramesh Kumar").relationship("HEAD").age(42).gender("male").build(),
                FamilyMemberDto.builder().id(2).name("Sunita Kumar").relationship("Spouse").age(38).gender("female").build()
        );
        when(familyUnitService.listMembers(phone)).thenReturn(members);

        TokenDto familyDraft = TokenDto.builder().id(50).sessionStep("awaiting_family_selection").build();
        when(queueManagerService.createFamilyRegisteringToken(phone)).thenReturn(familyDraft);

        // Step 1: User sends "book"
        ResponseEntity<String> r1 = webhookController.receive(createMessagePayload(phone, "book"));
        assertEquals(200, r1.getStatusCode().value());

        // Verify family selection prompt was sent containing both members
        ArgumentCaptor<String> msgCaptor = ArgumentCaptor.forClass(String.class);
        verify(whatsAppService).sendWhatsAppMessage(eq(phone), msgCaptor.capture());
        String prompt = msgCaptor.getValue();
        assertTrue(prompt.contains("Ramesh Kumar"));
        assertTrue(prompt.contains("Sunita Kumar"));
        assertTrue(prompt.contains("Add Family Member"));

        // Step 2: User replies "2" to choose Sunita Kumar
        when(queueManagerService.getActiveToken(phone)).thenReturn(familyDraft);

        ResponseEntity<String> r2 = webhookController.receive(createMessagePayload(phone, "2"));
        assertEquals(200, r2.getStatusCode().value());

        // Verify Sunita Kumar was selected with memberId = 2
        verify(queueManagerService).selectFamilyMember(50, 2, "Sunita Kumar", 38, "female");
    }
}
