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
    private com.qdischarge.clinicqueue.security.JwtService jwtService;
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
        appProperties.setFrontendUrl("http://localhost:8080");
        waSessionService = mock(WaSessionService.class);
        botMessages = new BotMessages();
        accessService = mock(AccessService.class);
        familyUnitService = mock(FamilyUnitService.class);
        jwtService = mock(com.qdischarge.clinicqueue.security.JwtService.class);
        when(jwtService.generatePatientToken(anyString())).thenReturn("mock-jwt-token");
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
                familyUnitService,
                jwtService
        );
    }

    private ObjectNode createMetaMessagePayload(String phone, String text) {
        String cleanPhone = phone.replace("+", "");
        ObjectNode root = objectMapper.createObjectNode();
        root.put("object", "whatsapp_business_account");
        var entryArr = root.putArray("entry");
        var entry = entryArr.addObject();
        var changesArr = entry.putArray("changes");
        var change = changesArr.addObject();
        var value = change.putObject("value");
        var contacts = value.putArray("contacts");
        contacts.addObject().putObject("profile").put("name", "Ramesh");
        var messages = value.putArray("messages");
        var msg = messages.addObject();
        msg.put("from", cleanPhone);
        msg.put("type", "text");
        msg.putObject("text").put("body", text);
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
        when(familyUnitService.getMemberById(2)).thenReturn(members.get(1));

        TokenDto familyDraft = TokenDto.builder().id(50).sessionStep("awaiting_family_selection").build();
        when(queueManagerService.createFamilyRegisteringToken(phone)).thenReturn(familyDraft);

        // Step 1: User sends "book"
        ResponseEntity<String> r1 = webhookController.receive(createMetaMessagePayload(phone, "book"));
        assertEquals(200, r1.getStatusCode().value());

        // Verify family selection CTA URL button was sent
        verify(whatsAppService).sendUrlButtonMessage(eq(phone), anyString(), anyString(), anyString(), anyString(), anyString());

        // Step 2: User returns via #MEMBER:2 from WebView
        when(queueManagerService.getActiveToken(phone)).thenReturn(familyDraft);

        ResponseEntity<String> r2 = webhookController.receive(createMetaMessagePayload(phone, "#MEMBER:2"));
        assertEquals(200, r2.getStatusCode().value());

        // Verify Sunita Kumar was selected with memberId = 2
        verify(queueManagerService).selectFamilyMember(50, 2, "Sunita Kumar", 38, "female");
    }
}
