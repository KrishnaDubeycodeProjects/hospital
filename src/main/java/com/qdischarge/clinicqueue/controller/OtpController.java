package com.qdischarge.clinicqueue.controller;

import com.qdischarge.clinicqueue.asha.service.AshaWorkerService;
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
    private final AshaWorkerService ashaWorkerService;

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
            if ("WORKER".equalsIgnoreCase(request.purpose())) {
                Optional<String> workerRole = workerIdentityService.resolveWorkerRole(request.phone());
                if (workerRole.isEmpty()) {
                    Map<String, Object> err = body(false, "यह मोबाइल नंबर किसी आशा या स्वास्थ्य कार्यकर्ता के रूप में पंजीकृत नहीं है। कृपया अपने सीएचओ (CHO) से संपर्क करें।");
                    err.put("registered", false);
                    return ResponseEntity.status(403).body(err);
                }
                String role = workerRole.get();
                String normPhone = PhoneNormalizer.normalize(request.phone());
                body.put("token", jwtService.generateWorkerToken(normPhone, role));
                body.put("role", role);
                body.put("registered", true);
                ashaWorkerService.getProfileForMe(normPhone, role).ifPresent(p -> body.put("profile", p));
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
