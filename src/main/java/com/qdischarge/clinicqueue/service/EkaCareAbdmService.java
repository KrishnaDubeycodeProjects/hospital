package com.qdischarge.clinicqueue.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.dto.DrugDto;
import com.qdischarge.clinicqueue.dto.LabTestDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;


@Service
@RequiredArgsConstructor
@Slf4j
public class EkaCareAbdmService {

    private final AppProperties appProperties;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public record CachedToken(String token, long expiryEpochMs) {
        public boolean isValid(long bufferMs) {
            return token != null && System.currentTimeMillis() < (expiryEpochMs - bufferMs);
        }
    }

    private final AtomicReference<CachedToken> tokenHolder = new AtomicReference<>();

    public record AbdmResult(boolean success, int status, Object data, String error) {
    }

    /**
     * Authenticates with Eka Care Gateway and caches the bearer token thread-safely.
     */
    public String getAccessToken() {
        int bufferSeconds = appProperties.getEkaTokenRefreshBufferSeconds() > 0 ? appProperties.getEkaTokenRefreshBufferSeconds() : 300;
        long bufferMs = bufferSeconds * 1000L;
        CachedToken current = tokenHolder.get();
        if (current != null && current.isValid(bufferMs)) {
            return current.token();
        }

        synchronized (this) {
            current = tokenHolder.get();
            if (current != null && current.isValid(bufferMs)) {
                return current.token();
            }

            if (appProperties.getEkaClientId() == null || appProperties.getEkaClientId().isBlank()
                    || appProperties.getEkaClientSecret() == null || appProperties.getEkaClientSecret().isBlank()) {
                log.warn("⚠️ Eka Care ABDM Client ID / Secret not configured. Gateway calls will fail.");
                return null;
            }

            String url = getBaseUrl() + "/connect-auth/v1/account/login";
            Map<String, String> body = Map.of(
                    "client_id", appProperties.getEkaClientId(),
                    "client_secret", appProperties.getEkaClientSecret()
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            try {
                ResponseEntity<String> response = restTemplate.postForEntity(url, new HttpEntity<>(body, headers), String.class);
                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    JsonNode root = objectMapper.readTree(response.getBody());
                    String token = null;
                    if (root.has("access_token")) {
                        token = root.get("access_token").asText();
                    } else if (root.has("data") && root.get("data").has("access_token")) {
                        token = root.get("data").get("access_token").asText();
                    } else if (root.has("token")) {
                        token = root.get("token").asText();
                    } else if (root.has("data") && root.get("data").has("token")) {
                        token = root.get("data").get("token").asText();
                    }

                    if (token != null) {
                        long ttlSec = 3600;
                        if (root.has("expires_in")) {
                            ttlSec = root.get("expires_in").asLong(3600);
                        } else if (root.has("data") && root.get("data").has("expires_in")) {
                            ttlSec = root.get("data").get("expires_in").asLong(3600);
                        }
                        long now = System.currentTimeMillis();
                        CachedToken newCached = new CachedToken(token, now + (ttlSec * 1000L));
                        tokenHolder.set(newCached);
                        log.info("✅ Successfully authenticated with Eka Care ABDM Gateway (TTL: {}s)", ttlSec);
                        return token;
                    }
                }
            } catch (Exception e) {
                log.error("❌ Eka Care authentication error: {}", e.getMessage());
            }
            return null;
        }
    }

    private String getBaseUrl() {
        String base = appProperties.getEkaBaseUrl();
        return (base != null && !base.isBlank()) ? base.replaceAll("/+$", "") : "https://api.eka.care";
    }

    private HttpHeaders buildHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (appProperties.getEkaClientId() != null) {
            headers.set("client-id", appProperties.getEkaClientId());
        }
        String token = getAccessToken();
        if (token != null) {
            headers.setBearerAuth(token);
        }
        return headers;
    }

    public AbdmResult sendRequest(HttpMethod method, String endpoint, Object requestBody, Map<String, ?> queryParams) {
        String url = getBaseUrl() + endpoint;
        if (queryParams != null && !queryParams.isEmpty()) {
            StringBuilder sb = new StringBuilder(url);
            sb.append(url.contains("?") ? "&" : "?");
            boolean first = true;
            for (Map.Entry<String, ?> entry : queryParams.entrySet()) {
                if (!first) sb.append("&");
                sb.append(entry.getKey()).append("=").append(entry.getValue());
                first = false;
            }
            url = sb.toString();
        }

        try {
            HttpEntity<?> entity = new HttpEntity<>(requestBody, buildHeaders());
            ResponseEntity<String> response = restTemplate.exchange(url, method, entity, String.class);
            Object data = response.getBody() != null ? objectMapper.readTree(response.getBody()) : Map.of();
            return new AbdmResult(true, response.getStatusCode().value(), data, null);
        } catch (HttpStatusCodeException e) {
            log.warn("ABDM request {} failed: {} - {}", endpoint, e.getStatusCode(), e.getResponseBodyAsString());
            return new AbdmResult(false, e.getStatusCode().value(), null, e.getResponseBodyAsString());
        } catch (Exception e) {
            log.error("ABDM request {} error: {}", endpoint, e.getMessage());
            return new AbdmResult(false, 500, null, e.getMessage());
        }
    }

    // --- M1: Identity & KYC ---

    /**
     * Initializes KYC OTP for ABHA creation or login via Eka Care ABDM.
     * @param method "aadhaar" or "abha-number"
     * @param identifier 12-digit Aadhaar or 14-digit ABHA Number
     */
    public AbdmResult initKyc(String method, String identifier) {
        String resolvedMethod = (method != null && method.toLowerCase().contains("aadhaar")) ? "aadhaar" : "abha-number";
        Map<String, String> body = Map.of(
                "method", resolvedMethod,
                "identifier", identifier != null ? identifier.trim() : ""
        );
        return sendRequest(HttpMethod.POST, "/abdm/v1/profile/kyc/init", body, null);
    }

    /**
     * Verifies the OTP sent during KYC/Login initialization.
     */
    public AbdmResult verifyLoginOtp(String txnId, String otp) {
        Map<String, String> body = Map.of("txn_id", txnId, "otp", otp);
        return sendRequest(HttpMethod.POST, "/abdm/na/v1/profile/login/verify", body, null);
    }

    /**
     * Checks if an ABHA address (e.g. name@abdm) is available.
     */
    public AbdmResult checkAbhaAddress(String abhaAddress) {
        return sendRequest(HttpMethod.GET, "/abdm/v1/registration/check-address", null, Map.of("abha_address", abhaAddress));
    }

    // --- M2: Care Contexts & HIP ---

    public AbdmResult discoverPatient(String mobile, String patientName) {
        Map<String, String> body = Map.of("mobile", mobile, "name", patientName);
        return sendRequest(HttpMethod.POST, "/abdm/v1/hip/patient/discover", body, null);
    }

    public AbdmResult linkCareContext(String patientReference, Object careContexts) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("patientReference", patientReference);
        body.put("careContexts", careContexts);
        return sendRequest(HttpMethod.POST, "/abdm/v1/hip/care-context/link", body, null);
    }

    // --- M3: Consent Management & HIU ---

    public AbdmResult initConsent(Object consentPayload) {
        return sendRequest(HttpMethod.POST, "/abdm/v1/hiu/consent/init", consentPayload, null);
    }

    public AbdmResult getConsentStatus(String consentRequestId) {
        return sendRequest(HttpMethod.GET, "/abdm/v1/hiu/consent/status/" + consentRequestId, null, null);
    }

    // --- Live Medical DB & Drug Registry ---

    /**
     * Live search from Eka Care Medical Database API (/medical-db/v1/drugs-and-labs).
     */
    public List<DrugDto> searchLiveDrugs(String query, int limit) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        try {
            String encoded = URLEncoder.encode(query.trim(), StandardCharsets.UTF_8);
            String endpoint = "/medical-db/v1/drugs-and-labs?q=" + encoded + "&limit=" + limit + "&s_type=drug";
            AbdmResult res = sendRequest(HttpMethod.GET, endpoint, null, null);
            if (res.success() && res.data() != null) {
                JsonNode root = objectMapper.valueToTree(res.data());
                JsonNode drugsNode = root.path("drugs");
                if (drugsNode.isArray() && !drugsNode.isEmpty()) {
                    List<DrugDto> list = new ArrayList<>();
                    for (JsonNode d : drugsNode) {
                        String name = d.path("name").asText();
                        String genericName = d.path("generic_name").asText("");
                        String brandName = d.path("common_name").asText(name);
                        String form = d.path("dosage").path("dosage_form").asText(d.path("product_type").asText("Tablet"));
                        String strength = d.path("product_sku").asText("");
                        String genericId = d.path("generic_id").asText("");

                        list.add(DrugDto.builder()
                                .name(name)
                                .genericName(genericName.isBlank() ? name : genericName)
                                .brandName(brandName)
                                .form(form)
                                .strength(strength)
                                .snomedCode(genericId)
                                .isNlem(false)
                                .defaultDosage("1-0-1")
                                .defaultFrequency("Twice daily")
                                .defaultDurationDays(5)
                                .defaultInstructions("After food")
                                .build());
                    }
                    return list;
                }
            }
        } catch (Exception e) {
            log.warn("Failed fetching live drugs from Eka Care Medical DB: {}", e.getMessage());
        }
        return List.of();
    }

    /**
     * Live search for diagnostic lab tests from Eka Care Medical Database API (/medical-db/v1/drugs-and-labs?s_type=lab).
     */
    public List<LabTestDto> searchLiveLabs(String query, int limit) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        try {
            String encoded = URLEncoder.encode(query.trim(), StandardCharsets.UTF_8);
            String endpoint = "/medical-db/v1/drugs-and-labs?q=" + encoded + "&limit=" + limit + "&s_type=lab";
            AbdmResult res = sendRequest(HttpMethod.GET, endpoint, null, null);
            if (res.success() && res.data() != null) {
                JsonNode root = objectMapper.valueToTree(res.data());
                JsonNode labsNode = root.path("lab_tests");
                if (labsNode.isArray() && !labsNode.isEmpty()) {
                    List<LabTestDto> list = new ArrayList<>();
                    for (JsonNode l : labsNode) {
                        String id = l.path("id").asText();
                        String name = l.path("name").asText();
                        String commonName = l.path("common_name").asText(name);

                        list.add(LabTestDto.builder()
                                .id(id)
                                .name(name)
                                .commonName(commonName)
                                .category("Diagnostic Investigation")
                                .sampleType("Standard Clinical Sample")
                                .isStandard(false)
                                .isLive(true)
                                .defaultTurnaroundHours(24)
                                .instructions("Standard clinical protocol")
                                .build());
                    }
                    return list;
                }
            }
        } catch (Exception e) {
            log.warn("Failed fetching live lab tests from Eka Care Medical DB: {}", e.getMessage());
        }
        return List.of();
    }

    /**
     * Evaluates current health and authentication status of the Eka Care ABDM Gateway.
     */
    public Map<String, Object> getGatewayStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        boolean configured = appProperties.getEkaClientId() != null && !appProperties.getEkaClientId().isBlank()
                && appProperties.getEkaClientSecret() != null && !appProperties.getEkaClientSecret().isBlank();
        status.put("configured", configured);
        status.put("baseUrl", getBaseUrl());
        status.put("clientId", configured ? appProperties.getEkaClientId().substring(0, Math.min(6, appProperties.getEkaClientId().length())) + "..." : null);
        String token = getAccessToken();
        status.put("authenticated", token != null);
        CachedToken ct = tokenHolder.get();
        if (ct != null) {
            status.put("tokenValidUntilEpochMs", ct.expiryEpochMs());
            status.put("tokenExpiresInSeconds", Math.max(0, (ct.expiryEpochMs() - System.currentTimeMillis()) / 1000));
        }
        status.put("liveMedicalDbAvailable", token != null);
        return status;
    }
}

