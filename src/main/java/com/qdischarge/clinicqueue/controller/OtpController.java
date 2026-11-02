package com.qdischarge.clinicqueue.controller;

import com.qdischarge.clinicqueue.asha.service.WorkerIdentityService;
import com.qdischarge.clinicqueue.dto.OtpSendRequest;
import com.qdischarge.clinicqueue.dto.OtpVerifyRequest;
import com.qdischarge.clinicqueue.security.JwtService;
import com.qdischarge.clinicqueue.service.OtpService;
import com.qdischarge.clinicqueue.util.PhoneNormalizer;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Public, rate-limited (see RateLimitFilter) phone-number OTP endpoints.
 * A verified phone stays "recently verified" for app.otp-ttl-minutes, which
 * QueueManagerService checks when app.otp-required-for-registration=true.
 *
 * A successful /verify also issues a ROLE_PATIENT JWT (subject = the phone
 * number) -- this *is* patient login/registration for the patient-facing
 * self-service endpoints (GET/POST /api/patients/**): there's no separate
 * password, just "prove you own this phone number right now."
 */
@RestController
@RequestMapping("/api/auth/otp")
@RequiredArgsConstructor
public class OtpController {

    private final OtpService otpService;
    private final JwtService jwtService;
    private final WorkerIdentityService workerIdentityService;

    @PostMapping("/send")
    public ResponseEntity<Map<String, Object>> send(@Valid @RequestBody OtpSendRequest request) {
        OtpService.OtpResult result = otpService.sendOtp(request.phone());
        Map<String, Object> body = body(result.success(), result.message());
        return ResponseEntity.status(result.success() ? 200 : 502).body(body);
    }


    @PostMapping("/verify")
    public ResponseEntity<Map<String, Object>> verify(@Valid @RequestBody OtpVerifyRequest request) {
        OtpService.OtpResult result = otpService.verifyOtp(request.phone(), request.code());
        Map<String, Object> body = body(result.success(), result.message());
        if (result.success()) {
            // Field app: a registered ASHA / ANM / CHO gets a worker token whose subject is the
            // OTP-proven phone. The role comes from server records only (never from the client).
            Optional<String> workerRole = "WORKER".equalsIgnoreCase(request.purpose())
                    ? workerIdentityService.resolveWorkerRole(request.phone())
                    : Optional.empty();
            if (workerRole.isPresent()) {
                body.put("token", jwtService.generateWorkerToken(PhoneNormalizer.normalize(request.phone()), workerRole.get()));
                body.put("role", workerRole.get());
            } else {
                body.put("token", jwtService.generatePatientToken(request.phone()));
                body.put("role", JwtService.PATIENT_ROLE);
            }
        }
        return ResponseEntity.status(result.success() ? 200 : 400).body(body);
    }

    private Map<String, Object> body(boolean success, String message) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", success);
        m.put("message", message);
        return m;
    }
}
