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
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Seeds demo credentials and 3 specific queue management test scenarios:
 * 1. OPD 30-min Closing Time cutoff & Tomorrow slot conversion
 * 2. Far-away patient distance anomaly & arrival priority boost
 * 3. Exponential backoff penalty for intentional delay / no-show
 *
 * Gated strictly to non-production environments to protect live hospital data.
 */
@Component
@Profile("!prod")
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
            log.info("🚀 Seeding video demo scenarios & credentials...");

            // 1. Ensure 'main' hospital exists and has doctor_join_code 'DOC123' and 3 active counters
            List<Integer> mainIds = jdbc.query(
                    "SELECT id FROM hospitals WHERE uri_slug = 'main' LIMIT 1",
                    Map.of(), (rs, rowNum) -> rs.getInt("id"));
            Integer mainHospitalId = mainIds.isEmpty() ? null : mainIds.get(0);

            if (mainHospitalId != null) {
                jdbc.update(
                        "UPDATE hospitals SET doctor_join_code = 'DOC123', active_counters = 3 WHERE id = :id",
                        Map.of("id", mainHospitalId));
            } else {
                mainHospitalId = jdbc.queryForObject(
                        """
                        INSERT INTO hospitals (uri_slug, name, address, digipin, latitude, longitude, open_time, close_time, avg_service_minutes, active_counters, doctor_join_code, categories)
                        VALUES ('main', 'Main Hospital', '123 Health Ave, Mumbai', '3C3P39L8T4', 28.6139, 77.2090, '09:00', '17:00', 10, 3, 'DOC123', 'General Medicine,Cardiology,Pediatrics')
                        RETURNING id
                        """,
                        Map.of(), Integer.class);
            }

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

            // 5. Seed Multi-Counter & Special Video Scenario Tokens for General Medicine if empty today
            Integer existingTokenCount = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM tokens WHERE hospital_id = :hId AND category = 'General Medicine' AND created_at::date = CURRENT_DATE",
                    Map.of("hId", mainHospitalId), Integer.class);

            if (existingTokenCount == null || existingTokenCount == 0) {
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
            }

            // 6. Seed Family Unit & Members for +91 88509 34544
            List<Integer> existingUnits = jdbc.query(
                    "SELECT id FROM family_units WHERE REPLACE(REPLACE(REPLACE(primary_phone, '+', ''), ' ', ''), '-', '') LIKE '%8850934544' LIMIT 1",
                    Map.of(), (rs, rowNum) -> rs.getInt("id"));
            int ahujaUnitId;
            if (existingUnits.isEmpty()) {
                ahujaUnitId = jdbc.queryForObject(
                        "INSERT INTO family_units (primary_phone, head_name) VALUES ('8850934544', 'Kavish Ahuja') RETURNING id",
                        Map.of(), Integer.class);
            } else {
                ahujaUnitId = existingUnits.get(0);
            }

            Integer fCount = jdbc.queryForObject(
                    "SELECT count(*) FROM family_members WHERE family_unit_id = :uId",
                    Map.of("uId", ahujaUnitId), Integer.class);
            if (fCount == null || fCount < 4) {
                jdbc.update("DELETE FROM family_members WHERE family_unit_id = :uId", Map.of("uId", ahujaUnitId));
                jdbc.update(
                        """
                        INSERT INTO family_members (family_unit_id, name, age, gender, relationship, phone, abha_number, abha_address, is_abha_linked) VALUES
                        (:uId, 'Kavish Ahuja', 20, 'male', 'Self', '8850934544', '91-8850-9345-4421', 'kavishahuja@abdm', TRUE),
                        (:uId, 'Sonia Ahuja', 48, 'female', 'Mother', null, null, null, FALSE),
                        (:uId, 'Subhash Ahuja', 52, 'male', 'Father', null, null, null, FALSE),
                        (:uId, 'Ayush Ahuja', 16, 'male', 'Brother', null, null, null, FALSE)
                        """,
                        Map.of("uId", ahujaUnitId));
                log.info("✅ Seeded 4 family members with linked ABHA in DB for Ahuja family (8850934544)");
            } else {
                // Ensure Kavish Ahuja has active ABHA details
                jdbc.update(
                        """
                        UPDATE family_members
                        SET abha_number = '91-8850-9345-4421', abha_address = 'kavishahuja@abdm', is_abha_linked = TRUE
                        WHERE family_unit_id = :uId AND relationship = 'Self' AND (abha_number IS NULL OR abha_address IS NULL)
                        """,
                        Map.of("uId", ahujaUnitId));
            }

            // Fetch Kavish's member id
            List<Integer> selfMemberIds = jdbc.query(
                    "SELECT id FROM family_members WHERE family_unit_id = :uId AND relationship = 'Self' LIMIT 1",
                    Map.of("uId", ahujaUnitId), (rs, rowNum) -> rs.getInt("id"));
            Integer kavishMemberId = selfMemberIds.isEmpty() ? null : selfMemberIds.get(0);

            // 7. Seed Visit History (token_history) for 8850934544
            Integer historyCount = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM token_history WHERE phone = '8850934544'",
                    Map.of(), Integer.class);
            if (historyCount == null || historyCount == 0) {
                jdbc.update(
                        """
                        INSERT INTO token_history (token_id, phone, name, age, gender, category, hospital_id, counter_id, created_at, served_at, completed_at, archived_at) VALUES
                        (101, '8850934544', 'Kavish Ahuja', 20, 'male', 'General Medicine', :hId, 1, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days' + INTERVAL '15 minutes', NOW() - INTERVAL '14 days' + INTERVAL '30 minutes', NOW() - INTERVAL '14 days'),
                        (102, '8850934544', 'Kavish Ahuja', 20, 'male', 'Cardiology', :hId, 2, NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days' + INTERVAL '20 minutes', NOW() - INTERVAL '35 days' + INTERVAL '45 minutes', NOW() - INTERVAL '35 days'),
                        (103, '8850934544', 'Kavish Ahuja', 20, 'male', 'General Medicine', :hId, 1, NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days' + INTERVAL '10 minutes', NOW() - INTERVAL '60 days' + INTERVAL '25 minutes', NOW() - INTERVAL '60 days')
                        """,
                        Map.of("hId", mainHospitalId));
                log.info("✅ Seeded 3 completed OPD visits in token_history for 8850934544");
            }

            // 8. Seed Clinical Care Courses (Episode of Care), Encounters, Prescriptions & Referrals for 8850934544
            Integer courseCount = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM courses WHERE patient_phone = '8850934544'",
                    Map.of(), Integer.class);
            if (courseCount == null || courseCount == 0) {
                // Fetch a doctor id
                List<Integer> docIds = jdbc.query(
                        "SELECT id FROM doctors WHERE phone = :phone LIMIT 1",
                        Map.of("phone", doctorPhone), (rs, rowNum) -> rs.getInt("id"));
                int docId = docIds.isEmpty() ? 1 : docIds.get(0);

                // Course 1: Hypertension & Cardiovascular Care
                Integer c1Id = jdbc.queryForObject(
                        """
                        INSERT INTO courses (patient_phone, patient_name, family_member_id, course_type, title, diagnosis, icd10_code, status, started_by_doctor_id, started_at_hospital_id, current_summary, created_at, updated_at)
                        VALUES ('8850934544', 'Kavish Ahuja', :mId, 'hypertension', 'Hypertension & Cardiovascular Monitoring', 'Essential (primary) hypertension', 'I10', 'active', :docId, :hId, 'Stage 2 hypertension managed with dual therapy. BP stabilized to 128/82 mmHg.', NOW() - INTERVAL '30 days', NOW() - INTERVAL '2 days')
                        RETURNING id
                        """,
                        Map.of("mId", kavishMemberId != null ? kavishMemberId : 1, "docId", docId, "hId", mainHospitalId),
                        Integer.class);

                if (c1Id != null) {
                    // Encounter 1
                    Integer enc1Id = jdbc.queryForObject(
                            """
                            INSERT INTO course_encounters (course_id, doctor_id, hospital_id, visit_date, chief_complaint, clinical_notes, examination_findings, plan, created_at)
                            VALUES (:cId, :docId, :hId, NOW() - INTERVAL '14 days', 'Routine follow-up for elevated blood pressure and morning headaches.', 'BP 142/90 mmHg, Pulse 74 bpm. Cardiovascular and respiratory exam normal.', 'CVS: S1, S2 audible, no murmurs. Chest: Bilateral vesicular breath sounds clear.', 'Continue dual antihypertensive therapy. Prescribed Telmisartan and Amlodipine. Refer for 2D-Echocardiogram.', NOW() - INTERVAL '14 days')
                            RETURNING id
                            """,
                            Map.of("cId", c1Id, "docId", docId, "hId", mainHospitalId),
                            Integer.class);

                    // Prescriptions for Encounter 1
                    jdbc.update(
                            """
                            INSERT INTO course_prescriptions (course_id, encounter_id, doctor_id, medicine_name, snomed_code, dosage, frequency, duration_days, route, instructions, is_nlem, created_at) VALUES
                            (:cId, :encId, :docId, 'Telmisartan 40mg', '318851002', '40mg', 'Once daily (Morning)', 30, 'Oral', 'Take before breakfast with water', TRUE, NOW() - INTERVAL '14 days'),
                            (:cId, :encId, :docId, 'Amlodipine 5mg', '318445009', '5mg', 'Once daily (Night)', 30, 'Oral', 'Take after dinner', TRUE, NOW() - INTERVAL '14 days')
                            """,
                            Map.of("cId", c1Id, "encId", enc1Id, "docId", docId));

                    // Referral for Encounter 1 (Tiered priority to Cardiology)
                    jdbc.update(
                            """
                            INSERT INTO course_referrals (course_id, encounter_id, referring_doctor_id, from_hospital_id, to_hospital_id, target_department, reason, priority_tier, valid_until, status, created_at)
                            VALUES (:cId, :encId, :docId, :hId, :hId, 'Cardiology', '2D-Echocardiography and evaluation for left ventricular hypertrophy due to hypertension.', 'semi_urgent_14d', CURRENT_DATE + INTERVAL '14 days', 'issued', NOW() - INTERVAL '2 days')
                            """,
                            Map.of("cId", c1Id, "encId", enc1Id, "docId", docId, "hId", mainHospitalId));
                }

                // Course 2: Type 2 Diabetes Care
                Integer c2Id = jdbc.queryForObject(
                        """
                        INSERT INTO courses (patient_phone, patient_name, family_member_id, course_type, title, diagnosis, icd10_code, status, started_by_doctor_id, started_at_hospital_id, current_summary, created_at, updated_at)
                        VALUES ('8850934544', 'Kavish Ahuja', :mId, 'diabetes', 'Type 2 Diabetes Mellitus Continuous Care', 'Type 2 diabetes mellitus without complications', 'E11.9', 'active', :docId, :hId, 'Fasting blood sugar 118 mg/dL, HbA1c 6.8%. Well controlled on Metformin.', NOW() - INTERVAL '60 days', NOW() - INTERVAL '10 days')
                        RETURNING id
                        """,
                        Map.of("mId", kavishMemberId != null ? kavishMemberId : 1, "docId", docId, "hId", mainHospitalId),
                        Integer.class);

                if (c2Id != null) {
                    Integer enc2Id = jdbc.queryForObject(
                            """
                            INSERT INTO course_encounters (course_id, doctor_id, hospital_id, visit_date, chief_complaint, clinical_notes, examination_findings, plan, created_at)
                            VALUES (:cId, :docId, :hId, NOW() - INTERVAL '10 days', 'Quarterly diabetic check-up and lab review.', 'Fasting sugar 118 mg/dL, PPBS 148 mg/dL. HbA1c 6.8%. BMI 23.4.', 'No diabetic neuropathy symptoms. Peripheral pulses palpable and symmetric.', 'Maintain current low-glycemic diet and exercise regimen. Continue Metformin 500mg.', NOW() - INTERVAL '10 days')
                            RETURNING id
                            """,
                            Map.of("cId", c2Id, "docId", docId, "hId", mainHospitalId),
                            Integer.class);

                    jdbc.update(
                            """
                            INSERT INTO course_prescriptions (course_id, encounter_id, doctor_id, medicine_name, snomed_code, dosage, frequency, duration_days, route, instructions, is_nlem, created_at)
                            VALUES (:cId, :encId, :docId, 'Metformin 500mg', '318851005', '500mg', 'Twice daily with meals', 60, 'Oral', 'Take immediately after lunch and dinner', TRUE, NOW() - INTERVAL '10 days')
                            """,
                            Map.of("cId", c2Id, "encId", enc2Id, "docId", docId));
                }

                log.info("✅ Seeded 2 Clinical Care Courses, Encounters, Prescriptions & Referrals for 8850934544");
            }

            // 9. Seed Patient Documents (Prescriptions & Lab Reports) for all family members under 8850934544 / +918850934544
            Integer docCount = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM patient_documents WHERE patient_phone IN ('8850934544', '+918850934544') AND file_name LIKE '%.pdf'",
                    Map.of(), Integer.class);
            if (docCount == null || docCount < 4) {
                byte[] mockPdfData = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n00000000118 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n215\n%%EOF".getBytes(StandardCharsets.UTF_8);

                jdbc.update(
                        """
                        INSERT INTO patient_documents (patient_phone, patient_name, patient_age, doc_type, hospital_id, file_name, content_type, file_size, file_data, created_at)
                        VALUES
                        ('+918850934544', 'Kavish Ahuja', 24, 'prescription', :hId, 'Rx_Kavish_Augmentin_AIIMS.pdf', 'application/pdf', :size, :data, NOW() - INTERVAL '2 days'),
                        ('+918850934544', 'Kavish Ahuja', 24, 'prescription', :hId, 'Rx_Kavish_Dolo650_Safdarjung.pdf', 'application/pdf', :size, :data, NOW() - INTERVAL '10 days'),
                        ('+918850934544', 'Kavish Ahuja', 24, 'report', :hId, 'CBC_Report_Kavish.pdf', 'application/pdf', :size, :data, NOW() - INTERVAL '8 days'),
                        ('+918850934544', 'Sonia Ahuja', 52, 'prescription', :hId, 'Rx_Sonia_TelmaAM_Fortis.pdf', 'application/pdf', :size, :data, NOW() - INTERVAL '6 days'),
                        ('+918850934544', 'Sonia Ahuja', 52, 'prescription', :hId, 'Rx_Sonia_Rozavel_Fortis.pdf', 'application/pdf', :size, :data, NOW() - INTERVAL '6 days'),
                        ('+918850934544', 'Sonia Ahuja', 52, 'report', :hId, 'Lipid_LFT_Sonia_Ahuja.pdf', 'application/pdf', :size, :data, NOW() - INTERVAL '8 days'),
                        ('+918850934544', 'Subhash Ahuja', 58, 'prescription', :hId, 'Rx_Subhash_Glycomet_RML.pdf', 'application/pdf', :size, :data, NOW() - INTERVAL '1 day'),
                        ('+918850934544', 'Subhash Ahuja', 58, 'report', :hId, 'HbA1c_Subhash_Report.pdf', 'application/pdf', :size, :data, NOW() - INTERVAL '3 days'),
                        ('+918850934544', 'Ayushman Ahuja', 19, 'prescription', :hId, 'Rx_Ayushman_Azithral_Apollo.pdf', 'application/pdf', :size, :data, NOW() - INTERVAL '12 days'),
                        ('+918850934544', 'Ayushman Ahuja', 19, 'report', :hId, 'Throat_Culture_Ayushman.pdf', 'application/pdf', :size, :data, NOW() - INTERVAL '12 days')
                        ON CONFLICT DO NOTHING
                        """,
                        Map.of("hId", mainHospitalId, "size", mockPdfData.length, "data", mockPdfData));
                log.info("✅ Seeded clinical documents for all family members under +918850934544");
            }

            log.info("✅ Video Demo Scenarios, Clinical Courses, Referrals & Credentials successfully seeded!");
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
