package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.security.SecureRandom;
import java.util.List;
import java.util.Map;

/**
 * Phone-number OTP verification, gating (optionally) patient registration --
 * "message OTP auth with Twilio". Three providers, selected by app.otp-provider:
 *
 *  - "twilio": delegates code generation/expiry/matching entirely to Twilio's
 *    Verify API (Send + VerificationCheck), the standard way to do SMS OTP
 *    without owning that state yourself. Needs TWILIO_ACCOUNT_SID /
 *    TWILIO_AUTH_TOKEN / TWILIO_VERIFY_SERVICE_SID; ships with dummy
 *    placeholders by default (see .env.example) that fail cleanly (401, not
 *    a crash) until real credentials are set.
 *  - "twilio-sms": we own generation/expiry/matching (like "log" below), but
 *    deliver the code as a real SMS via Twilio's plain Messages API through a
 *    Messaging Service (POST .../Messages.json with MessagingServiceSid),
 *    rather than the Verify API. Needs TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN
 *    / TWILIO_MESSAGING_SERVICE_SID.
 *  - "log" (default, dev-friendly): generates its own 6-digit code, stores
 *    only its BCrypt hash (otp_verifications.code_hash) with an expiry and
 *    an attempt cap, and logs the plaintext code instead of sending an SMS --
 *    so OTP flows are fully testable with zero external accounts.
 *
 * Twilio -> WhatsApp fallback: if a Twilio Verify or Twilio SMS send call
 * itself fails (account issue, network, Twilio outage -- not "wrong code",
 * which is a normal verify failure), sendOtp() falls back to generating/
 * hashing its own code exactly like the "log" provider does, but delivers it
 * over WhatsApp (via WhatsAppService, which has its own Meta<->Evolution
 * failover) instead of SMS. verifyOtp() then has to know which path a given
 * phone's code came from without any extra state: it checks for a pending
 * unverified local row first (present whenever the code was generated
 * locally -- "log", "twilio-sms", or a WhatsApp fallback) and verifies
 * against that; only if there isn't one does it ask Twilio's
 * VerificationCheck, which is only reachable when "twilio" (Verify) is
 * configured and its own send succeeded.
 *
 * Either way, a successful verifyOtp() records a "phone verified recently"
 * ledger row so QueueManagerService can gate token creation on it
 * uniformly, regardless of which provider/path actually did the checking.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OtpService {

    private final AppProperties appProperties;
    private final NamedParameterJdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final RestTemplate restTemplate;
    private final WhatsAppService whatsAppService;

    private static final int MAX_ATTEMPTS = 5;
    private static final SecureRandom RANDOM = new SecureRandom();

    private boolean isTwilio() {
        return "twilio".equalsIgnoreCase(appProperties.getOtpProvider());
    }

    private boolean isTwilioSms() {
        return "twilio-sms".equalsIgnoreCase(appProperties.getOtpProvider());
    }

    public record OtpResult(boolean success, String message) {
    }

    public OtpResult sendOtp(String phone) {
        if (isTwilio()) {
            return sendViaTwilio(phone);
        }
        if (isTwilioSms()) {
            return sendViaTwilioSms(phone);
        }
        return sendViaLog(phone);
    }

    public OtpResult verifyOtp(String phone, String code) {
        // A pending local row only exists when sendOtp() fell back to WhatsApp delivery
        // (see sendViaTwilio) -- in that case Twilio never has a code to check, so verify
        // locally instead. Otherwise this phone's code was sent by whichever provider is
        // configured (Twilio's Verify API owns the check, or it's the "log" provider).
        boolean useLocalVerify = !isTwilio() || hasPendingLocalOtp(phone);
        OtpResult result = useLocalVerify ? verifyViaLog(phone, code) : verifyViaTwilio(phone, code);
        if (result.success()) {
            recordVerifiedLedger(phone);
        }
        return result;
    }

    /** Has this phone completed OTP verification within the configured TTL? Used to gate token creation. */
    public boolean isPhoneVerifiedRecently(String phone) {
        Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*)::int FROM otp_verifications
                WHERE phone = :phone AND verified = TRUE
                  AND verified_at > NOW() - (:ttl || ' minutes')::INTERVAL
                """,
                Map.of("phone", phone, "ttl", String.valueOf(appProperties.getOtpTtlMinutes())), Integer.class);
        return count != null && count > 0;
    }

    // -------------------------------------------------------------
    // "log" provider: we own generation, hashing, expiry, attempts
    // -------------------------------------------------------------

    private OtpResult sendViaLog(String phone) {
        String code = generateAndStoreLocalOtp(phone);
        log.info("🔐 [DEV OTP] Code for {} is {} (valid {} min). No real SMS was sent -- set OTP_PROVIDER=twilio for that.",
                phone, code, appProperties.getOtpTtlMinutes());
        return new OtpResult(true, "OTP sent.");
    }

    /** Generates a 6-digit code, stores only its BCrypt hash, and returns the plaintext to whoever's delivering it. */
    private String generateAndStoreLocalOtp(String phone) {
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        String hash = passwordEncoder.encode(code);

        jdbc.update(
                """
                INSERT INTO otp_verifications (phone, code_hash, purpose, expires_at)
                VALUES (:phone, :hash, 'registration', NOW() + (:ttl || ' minutes')::INTERVAL)
                """,
                Map.of("phone", phone, "hash", hash, "ttl", String.valueOf(appProperties.getOtpTtlMinutes())));
        return code;
    }

    /** Is there a locally-generated, unverified, unexpired code pending for this phone? Only true after a Twilio->WhatsApp fallback send. */
    private boolean hasPendingLocalOtp(String phone) {
        Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*)::int FROM otp_verifications
                WHERE phone = :phone AND verified = FALSE AND expires_at > NOW()
                """,
                Map.of("phone", phone), Integer.class);
        return count != null && count > 0;
    }

    private OtpResult verifyViaLog(String phone, String code) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                """
                SELECT id, code_hash, attempts FROM otp_verifications
                WHERE phone = :phone AND verified = FALSE AND expires_at > NOW()
                ORDER BY created_at DESC LIMIT 1
                """,
                Map.of("phone", phone));

        if (rows.isEmpty()) {
            return new OtpResult(false, "No active OTP for this number. Request a new one.");
        }

        Map<String, Object> row = rows.get(0);
        int id = (Integer) row.get("id");
        int attempts = (Integer) row.get("attempts");
        String hash = (String) row.get("code_hash");

        if (attempts >= MAX_ATTEMPTS) {
            return new OtpResult(false, "Too many incorrect attempts. Request a new OTP.");
        }

        jdbc.update("UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = :id", Map.of("id", id));

        if (!passwordEncoder.matches(code, hash)) {
            return new OtpResult(false, "Incorrect OTP.");
        }

        jdbc.update("UPDATE otp_verifications SET verified = TRUE, verified_at = NOW() WHERE id = :id", Map.of("id", id));
        return new OtpResult(true, "OTP verified.");
    }

    // -------------------------------------------------------------
    // "twilio" provider: Twilio Verify owns generation/expiry/matching
    // -------------------------------------------------------------

    private HttpHeaders twilioHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setBasicAuth(appProperties.getTwilioAccountSid(), appProperties.getTwilioAuthToken());
        return headers;
    }

    private OtpResult sendViaTwilio(String phone) {
        String url = "https://verify.twilio.com/v2/Services/%s/Verifications"
                .formatted(appProperties.getTwilioVerifyServiceSid());
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("To", phone);
        body.add("Channel", "sms");
        try {
            restTemplate.postForEntity(url, new HttpEntity<>(body, twilioHeaders()), Map.class);
            return new OtpResult(true, "OTP sent via SMS.");
        } catch (RestClientException e) {
            log.error("❌ Twilio Verify send error for {}: {} -- falling back to WhatsApp delivery.", phone, extractError(e));
            return sendViaWhatsAppFallback(phone);
        }
    }

    // -------------------------------------------------------------
    // "twilio-sms" provider: we own generation/expiry/matching, Twilio's
    // plain Messages API (not Verify) just delivers the SMS
    // -------------------------------------------------------------

    private OtpResult sendViaTwilioSms(String phone) {
        String code = generateAndStoreLocalOtp(phone);
        String url = "https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json"
                .formatted(appProperties.getTwilioAccountSid());
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("To", phone);
        body.add("MessagingServiceSid", appProperties.getTwilioMessagingServiceSid());
        body.add("Body", "Your verification code is " + code + " (valid " + appProperties.getOtpTtlMinutes() + " minutes).");
        try {
            restTemplate.postForEntity(url, new HttpEntity<>(body, twilioHeaders()), Map.class);
            return new OtpResult(true, "OTP sent via SMS.");
        } catch (RestClientException e) {
            log.error("❌ Twilio Messages API send error for {}: {} -- falling back to WhatsApp delivery.", phone, extractError(e));
            whatsAppService.sendWhatsAppMessage(phone,
                    "🔐 Your verification code is *" + code + "* (valid " + appProperties.getOtpTtlMinutes()
                            + " minutes). We couldn't reach you by SMS just now, so we sent this over WhatsApp instead.");
            return new OtpResult(true, "Could not send OTP via SMS right now -- sent your verification code via WhatsApp instead.");
        }
    }

    /**
     * Twilio's SMS send failed (account/network/Twilio outage) -- rather than
     * leave the patient stuck, generate our own code (same as the "log"
     * provider) and deliver it over WhatsApp instead, via WhatsAppService
     * (which itself fails over between Meta and Evolution). verifyOtp() picks
     * this path back up automatically via hasPendingLocalOtp().
     */
    private OtpResult sendViaWhatsAppFallback(String phone) {
        String code = generateAndStoreLocalOtp(phone);
        whatsAppService.sendWhatsAppMessage(phone,
                "🔐 Your verification code is *" + code + "* (valid " + appProperties.getOtpTtlMinutes()
                        + " minutes). We couldn't reach you by SMS just now, so we sent this over WhatsApp instead.");
        return new OtpResult(true, "Could not send OTP via SMS right now -- sent your verification code via WhatsApp instead.");
    }

    private OtpResult verifyViaTwilio(String phone, String code) {
        String url = "https://verify.twilio.com/v2/Services/%s/VerificationCheck"
                .formatted(appProperties.getTwilioVerifyServiceSid());
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("To", phone);
        body.add("Code", code);
        try {
            var response = restTemplate.postForEntity(url, new HttpEntity<>(body, twilioHeaders()), Map.class);
            String status = response.getBody() != null ? String.valueOf(response.getBody().get("status")) : null;
            if ("approved".equals(status)) {
                return new OtpResult(true, "OTP verified.");
            }
            return new OtpResult(false, "Incorrect or expired OTP.");
        } catch (RestClientException e) {
            log.error("❌ Twilio Verify check error for {}: {}", phone, extractError(e));
            return new OtpResult(false, "Could not verify OTP right now. Please try again.");
        }
    }

    private String extractError(RestClientException e) {
        if (e instanceof HttpStatusCodeException hsce) {
            return hsce.getStatusCode() + " " + hsce.getResponseBodyAsString();
        }
        return e.getMessage();
    }

    private void recordVerifiedLedger(String phone) {
        jdbc.update(
                """
                INSERT INTO otp_verifications (phone, code_hash, purpose, expires_at, verified, verified_at)
                VALUES (:phone, 'EXTERNALLY_VERIFIED', 'registration', NOW() + (:ttl || ' minutes')::INTERVAL, TRUE, NOW())
                """,
                Map.of("phone", phone, "ttl", String.valueOf(appProperties.getOtpTtlMinutes())));
    }
}
