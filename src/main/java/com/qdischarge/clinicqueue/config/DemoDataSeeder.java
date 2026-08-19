package com.qdischarge.clinicqueue.config;

import com.qdischarge.clinicqueue.service.HospitalDepartmentService;
import com.qdischarge.clinicqueue.service.HospitalService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Seeds demo credentials and 3 specific queue management test scenarios:
 * 1. OPD 30-min Closing Time cutoff & Tomorrow slot conversion
 * 2. Far-away patient distance anomaly & arrival priority boost
 * 3. Exponential backoff penalty for intentional delay / no-show
 */
@Component
@Order(200)
@RequiredArgsConstructor
@Slf4j
public class DemoDataSeeder implements ApplicationRunner {

    private final NamedParameterJdbcTemplate jdbc;
    private final HospitalService hospitalService;
    private final HospitalDepartmentService hospitalDepartmentService;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(ApplicationArguments args) {
        try {
            // 1. Only run against a *real* 'main'-slugged hospital that someone deliberately
            // created. This used to fabricate one on every startup -- name "Main Hospital",
            // address "123 Health Ave, Mumbai", lat/lon 28.6139/77.2090 (that's New Delhi's
            // India Gate, not Mumbai) -- which kept reappearing as a bogus placeholder hospital
            // no matter how many times it was deleted. No 'main' hospital -> skip the whole
            // demo-scenario seed instead of inventing one.
            List<Integer> mainIds = jdbc.query(
                    "SELECT id FROM hospitals WHERE uri_slug = 'main' LIMIT 1",
                    Map.of(), (rs, rowNum) -> rs.getInt("id"));
            if (mainIds.isEmpty()) {
                log.info("ℹ️ No 'main' hospital configured -- skipping video demo scenario seeding (this is expected once the fake placeholder hospital is removed).");
                return;
            }
            Integer mainHospitalId = mainIds.get(0);

            log.info("🚀 Seeding video demo scenarios & credentials against hospital #{}...", mainHospitalId);
            jdbc.update(
                    "UPDATE hospitals SET doctor_join_code = 'DOC123', active_counters = 3 WHERE id = :id",
                    Map.of("id", mainHospitalId));

            // 2. Ensure General Medicine department exists with 3 active counters
            hospitalDepartmentService.ensure(mainHospitalId, "General Medicine");
            hospitalDepartmentService.updateCounters(mainHospitalId, "General Medicine", 3);

            // 3. Register Test Doctor: Dr. Rajesh Sharma
            String doctorPhone = "+919888877777";
            try {
                List<Integer> docIds = jdbc.query(
                        "SELECT id FROM doctors WHERE phone = :phone",
                        Map.of("phone", doctorPhone),
                        (rs, rowNum) -> rs.getInt("id"));
                Integer docId = docIds.isEmpty() ? null : docIds.get(0);

                if (docId == null) {
                    jdbc.update(
                            """
                            INSERT INTO doctors (phone, name, hospital_id, counter_id, category)
                            VALUES (:phone, 'Dr. Rajesh Sharma', :hospitalId, 1, 'General Medicine')
                            """,
                            Map.of("phone", doctorPhone, "hospitalId", mainHospitalId));
                } else {
                    jdbc.update(
                            "UPDATE doctors SET hospital_id = :hospitalId, counter_id = 1, category = 'General Medicine' WHERE id = :id",
                            Map.of("hospitalId", mainHospitalId, "id", docId));
                }
            } catch (Exception e) {
                log.warn("Note: doctor registration seeding fallback: {}", e.getMessage());
            }

            // 4. Pre-verify OTP for Doctor and Test Patients
            String codeHash = passwordEncoder.encode("123456");
            String[] testPhones = {
                    doctorPhone,
                    "+919100000001", "+919100000002", "+919100000003", "+919100000004", "+919100000005",
                    "+919100000006", "+919100000007", "+919100000008", "+919100000009", "+919100000010",
                    "+919100000011", "+919100000012"
            };

            for (String phone : testPhones) {
                jdbc.update(
                        """
                        INSERT INTO otp_verifications (phone, code_hash, purpose, expires_at, verified, verified_at)
                        VALUES (:phone, :hash, 'registration', NOW() + INTERVAL '30 days', TRUE, NOW())
                        """,
                        Map.of("phone", phone, "hash", codeHash));
            }

            // 5. Seed Multi-Counter & Special Video Scenario Tokens for General Medicine
            jdbc.update(
                    "DELETE FROM tokens WHERE hospital_id = :hId AND category = 'General Medicine' AND created_at::date = CURRENT_DATE",
                    Map.of("hId", mainHospitalId));

            // Multi-Counter Active Serving Tokens (Counters 1, 2, 3)
            seedToken(mainHospitalId, "General Medicine", 1, "Amit Kumar", 34, "male", "+919100000001", "serving", 1, null, 0, null, null, null);
            seedToken(mainHospitalId, "General Medicine", 2, "Priya Patel", 28, "female", "+919100000002", "serving", 2, null, 0, null, null, null);
            seedToken(mainHospitalId, "General Medicine", 3, "Suresh Verma", 52, "male", "+919100000003", "serving", 3, null, 0, null, null, null);

            // Look-Ahead Reserved Queue (Next up for Counters 1, 2, 3)
            seedToken(mainHospitalId, "General Medicine", 4, "Ananya Roy", 24, "female", "+919100000004", "waiting", null, 1, 0, null, null, null);
            seedToken(mainHospitalId, "General Medicine", 5, "Rahul Sharma", 45, "male", "+919100000005", "waiting", null, 2, 0, null, null, null);
            seedToken(mainHospitalId, "General Medicine", 6, "Deepak Gupta", 61, "male", "+919100000006", "waiting", null, 3, 0, null, null, null);

            // Standard Waiting Tokens
            seedToken(mainHospitalId, "General Medicine", 7, "Sunita Devi", 39, "female", "+919100000007", "waiting", null, null, 0, null, null, null);
            seedToken(mainHospitalId, "General Medicine", 8, "Vikram Singh", 50, "male", "+919100000008", "waiting", null, null, 0, null, null, null);

            // SPECIAL DEMO CASE 2: Far-Away Patient in Distance Anomaly Section (18.5 km away)
            seedToken(mainHospitalId, "General Medicine", 9, "Farhan Akhtar (Far Patient)", 35, "male", "+919100000011", "waiting", null, null, 0, 18.5, 45.0, "NOW() + INTERVAL '30 minutes'");

            // SPECIAL DEMO CASE 3: Intentional Delay / No-Show subjected to Exponential Backoff Penalty
            seedToken(mainHospitalId, "General Medicine", 10, "Rohan Mehta (Delayed Patient)", 42, "male", "+919100000012", "waiting", null, null, 2, 1.2, 5.0, null);

            log.info("✅ 3 Video Demo Scenarios & Credentials successfully seeded!");
            log.info("1️⃣ 30-min Close Time Block: Handled when booking within 30 min of OPD close time.");
            log.info("2️⃣ Distance Anomaly: Token #9 (Farhan Akhtar, 18.5 km away) flagged in Anomaly Section.");
            log.info("3️⃣ Exponential Backoff: Token #10 (Rohan Mehta, 2 No-Shows) demoted by 2^2=4 positions.");

        } catch (Exception e) {
            log.error("⚠️ Failed to seed demo scenarios: {}", e.getMessage(), e);
        }
    }

    private void seedToken(int hospitalId, String category, int dailyNumber, String name, int age, String gender,
                           String phone, String status, Integer counterId, Integer reservedCounterId,
                           int noShowCount, Double distanceKm, Double travelMinutes, String anomalyIntervalSql) {
        Map<String, Object> params = new HashMap<>();
        params.put("hospitalId", hospitalId);
        params.put("category", category);
        params.put("dailyNumber", dailyNumber);
        params.put("name", name);
        params.put("age", age);
        params.put("gender", gender);
        params.put("phone", phone);
        params.put("status", status);
        params.put("counterId", counterId);
        params.put("reservedCounterId", reservedCounterId);
        params.put("noShowCount", noShowCount);
        params.put("distanceKm", distanceKm);
        params.put("travelMinutes", travelMinutes);

        String sql = """
                INSERT INTO tokens (hospital_id, category, daily_number, name, age, gender, phone, status, session_step, counter_id, reserved_counter_id, no_show_count, distance_km, travel_minutes, anomaly_control_until, created_at)
                VALUES (:hospitalId, :category, :dailyNumber, :name, :age, :gender, :phone, :status, 'menu', :counterId, :reservedCounterId, :noShowCount, :distanceKm, :travelMinutes, %s, CURRENT_TIMESTAMP)
                """.formatted(anomalyIntervalSql != null ? anomalyIntervalSql : "NULL");

        jdbc.update(sql, params);
    }
}
