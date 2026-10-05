package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.dto.FamilyMemberDto;
import com.qdischarge.clinicqueue.dto.FamilyUnitDto;
import com.qdischarge.clinicqueue.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class TestEnvironmentService {

    private final NamedParameterJdbcTemplate jdbc;
    private final FamilyUnitService familyUnitService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public record TestPatientProfile(
            String phone,
            String headName,
            int familyUnitId,
            List<FamilyMemberDto> members,
            String jwtToken
    ) {}

    @Transactional
    public TestPatientProfile seedPatientTestEnvironment(String phone) {
        String cleanPhone = phone.trim();
        String digitsOnly = cleanPhone.replaceAll("[^0-9]", "");
        log.info("🧪 Initializing Test Patient Environment for: {}", cleanPhone);

        // 1. Ensure Family Unit exists
        FamilyUnitDto unit = familyUnitService.getFamilyUnit(cleanPhone);
        int unitId;
        if (unit == null) {
            unit = familyUnitService.getFamilyUnit(digitsOnly);
        }
        if (unit == null) {
            unitId = jdbc.queryForObject(
                    "INSERT INTO family_units (primary_phone, head_name) VALUES (:phone, 'Ramesh Kumar (Demo Patient)') RETURNING id",
                    Map.of("phone", cleanPhone), Integer.class);
        } else {
            unitId = unit.getId();
            jdbc.update("UPDATE family_units SET head_name = 'Ramesh Kumar (Demo Patient)' WHERE id = :id",
                    Map.of("id", unitId));
        }

        // 2. Ensure 4 family members exist
        Integer memberCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM family_members WHERE family_unit_id = :uId",
                Map.of("uId", unitId), Integer.class);

        if (memberCount == null || memberCount < 4) {
            jdbc.update("DELETE FROM family_members WHERE family_unit_id = :uId", Map.of("uId", unitId));
            jdbc.update(
                    """
                    INSERT INTO family_members (family_unit_id, name, age, gender, relationship, phone, abha_number, abha_address, is_abha_linked) VALUES
                    (:uId, 'Ramesh Kumar', 28, 'male', 'Self', :phone, '91-2345-6789-1011', 'ramesh.kumar@abdm', TRUE),
                    (:uId, 'Sunita Kumar', 26, 'female', 'Wife', null, '91-2345-6789-1012', 'sunita.kumar@abdm', TRUE),
                    (:uId, 'Aarav Kumar', 5, 'male', 'Son', null, null, null, FALSE),
                    (:uId, 'Kamla Devi', 62, 'female', 'Mother', null, '91-2345-6789-1013', 'kamla.devi@abdm', TRUE)
                    """,
                    Map.of("uId", unitId, "phone", cleanPhone));
        }

        // 3. Pre-verify OTP for login convenience (OTP: 123456)
        String codeHash = passwordEncoder.encode("123456");
        for (String p : List.of(cleanPhone, digitsOnly, "+91" + (digitsOnly.length() > 10 ? digitsOnly.substring(digitsOnly.length() - 10) : digitsOnly))) {
            try {
                jdbc.update("DELETE FROM otp_verifications WHERE phone = :phone AND purpose = 'registration'", Map.of("phone", p));
                jdbc.update(
                        """
                        INSERT INTO otp_verifications (phone, code_hash, purpose, expires_at, verified, verified_at)
                        VALUES (:phone, :hash, 'registration', NOW() + INTERVAL '30 days', TRUE, NOW())
                        """,
                        Map.of("phone", p, "hash", codeHash));
            } catch (Exception e) {
                log.warn("Could not pre-verify OTP for {}: {}", p, e.getMessage());
            }
        }

        // 4. Find primary hospital
        List<Integer> hospitalIds = jdbc.query(
                "SELECT id FROM hospitals ORDER BY CASE WHEN uri_slug = 'main' THEN 0 ELSE 1 END, id ASC LIMIT 1",
                Map.of(), (rs, rowNum) -> rs.getInt("id"));
        int hospitalId = hospitalIds.isEmpty() ? 1 : hospitalIds.get(0);

        // 5. Seed Patient Documents (Lab Report, Prescription, X-Ray, Discharge Summary)
        byte[] mockPdfData = ("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj "
                + "3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n"
                + "0000000010 00000 n\n0000000060 00000 n\n00000000118 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n215\n%%EOF")
                .getBytes(StandardCharsets.UTF_8);

        Integer existingDocs = jdbc.queryForObject(
                "SELECT COUNT(*) FROM patient_documents WHERE patient_phone IN (:phone, :digits)",
                Map.of("phone", cleanPhone, "digits", digitsOnly), Integer.class);

        if (existingDocs == null || existingDocs < 4) {
            jdbc.update(
                    """
                    INSERT INTO patient_documents (patient_phone, patient_name, patient_age, doc_type, hospital_id, file_name, content_type, file_size, file_data, created_at)
                    VALUES
                    (:phone, 'Ramesh Kumar', 28, 'report', :hId, 'CBC_Blood_Test_Report.pdf', 'application/pdf', :size, :data, NOW() - INTERVAL '3 days'),
                    (:phone, 'Ramesh Kumar', 28, 'prescription', :hId, 'Rx_GeneralMedicine_AIIMS.pdf', 'application/pdf', :size, :data, NOW() - INTERVAL '7 days'),
                    (:phone, 'Ramesh Kumar', 28, 'report', :hId, 'Chest_XRay_Report.pdf', 'application/pdf', :size, :data, NOW() - INTERVAL '14 days'),
                    (:phone, 'Sunita Kumar', 26, 'prescription', :hId, 'Rx_Gynecology_Care.pdf', 'application/pdf', :size, :data, NOW() - INTERVAL '5 days'),
                    (:phone, 'Kamla Devi', 62, 'report', :hId, 'Lipid_Profile_KamlaDevi.pdf', 'application/pdf', :size, :data, NOW() - INTERVAL '10 days')
                    """,
                    Map.of("phone", cleanPhone, "hId", hospitalId, "size", mockPdfData.length, "data", mockPdfData));
            log.info("📄 Seeded 5 dummy health documents for {}", cleanPhone);
        }

        // 6. Seed Clinical Care Course and Referral for Ramesh Kumar
        List<Integer> selfMemberIds = jdbc.query(
                "SELECT id FROM family_members WHERE family_unit_id = :uId AND relationship = 'Self' LIMIT 1",
                Map.of("uId", unitId), (rs, rowNum) -> rs.getInt("id"));
        Integer rameshMemberId = selfMemberIds.isEmpty() ? null : selfMemberIds.get(0);

        Integer courseCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM courses WHERE patient_phone IN (:phone, :digits)",
                Map.of("phone", cleanPhone, "digits", digitsOnly), Integer.class);

        if (courseCount == null || courseCount == 0) {
            List<Integer> docIds = jdbc.query(
                    "SELECT id FROM doctors ORDER BY id ASC LIMIT 1",
                    Map.of(), (rs, rowNum) -> rs.getInt("id"));
            int docId = docIds.isEmpty() ? 1 : docIds.get(0);

            Integer cId = jdbc.queryForObject(
                    """
                    INSERT INTO courses (patient_phone, patient_name, family_member_id, course_type, title, diagnosis, icd10_code, status, started_by_doctor_id, started_at_hospital_id, current_summary, created_at, updated_at)
                    VALUES (:phone, 'Ramesh Kumar', :mId, 'hypertension', 'Hypertension & Cardiac Follow-up', 'Essential (primary) hypertension', 'I10', 'active', :docId, :hId, 'Stage 1 hypertension under active monitoring.', NOW() - INTERVAL '20 days', NOW() - INTERVAL '2 days')
                    RETURNING id
                    """,
                    Map.of("phone", cleanPhone, "mId", rameshMemberId != null ? rameshMemberId : 1, "docId", docId, "hId", hospitalId),
                    Integer.class);

            if (cId != null) {
                Integer encId = jdbc.queryForObject(
                        """
                        INSERT INTO course_encounters (course_id, doctor_id, hospital_id, visit_date, chief_complaint, clinical_notes, examination_findings, plan, created_at)
                        VALUES (:cId, :docId, :hId, NOW() - INTERVAL '10 days', 'Occasional morning headache and elevated blood pressure.', 'BP 138/88 mmHg. Advised lifestyle modifications.', 'Chest clear, regular S1/S2 heart sounds.', 'Prescribed Amlodipine 5mg OD. Referred for 2D Echo.', NOW() - INTERVAL '10 days')
                        RETURNING id
                        """,
                        Map.of("cId", cId, "docId", docId, "hId", hospitalId),
                        Integer.class);

                jdbc.update(
                        """
                        INSERT INTO course_prescriptions (course_id, encounter_id, doctor_id, medicine_name, snomed_code, dosage, frequency, duration_days, route, instructions, is_nlem, created_at)
                        VALUES (:cId, :encId, :docId, 'Amlodipine 5mg', '318445009', '5mg', 'Once daily (Night)', 30, 'Oral', 'Take after dinner', TRUE, NOW() - INTERVAL '10 days')
                        """,
                        Map.of("cId", cId, "encId", encId, "docId", docId));

                jdbc.update(
                        """
                        INSERT INTO course_referrals (course_id, encounter_id, referring_doctor_id, from_hospital_id, to_hospital_id, target_department, reason, priority_tier, valid_until, status, created_at)
                        VALUES (:cId, :encId, :docId, :hId, :hId, 'Cardiology', '2D Echocardiogram and cardiology workup for persistent hypertension.', 'semi_urgent_14d', CURRENT_DATE + INTERVAL '14 days', 'issued', NOW() - INTERVAL '2 days')
                        """,
                        Map.of("cId", cId, "encId", encId, "docId", docId, "hId", hospitalId));
            }
            log.info("🏥 Seeded care courses, prescriptions and referrals for {}", cleanPhone);
        }

        List<FamilyMemberDto> members = familyUnitService.listMembers(cleanPhone);
        String jwtToken = jwtService.generatePatientToken(cleanPhone);

        log.info("✅ Test Patient Environment ready for {} with {} family members", cleanPhone, members.size());
        return new TestPatientProfile(cleanPhone, "Ramesh Kumar (Demo Patient)", unitId, members, jwtToken);
    }

    @Transactional
    public Map<String, Object> injectTestToken(
            String name, Integer age, String gender, String phone,
            String category, Integer hospitalId, String status,
            Double distanceKm, Integer travelMinutes) {

        String cleanPhone = (phone != null && !phone.isBlank()) ? phone.trim() : "+919100000099";
        String cat = (category != null && !category.isBlank()) ? category : "General Medicine";
        int hId = (hospitalId != null && hospitalId > 0) ? hospitalId : 1;
        String st = (status != null && !status.isBlank()) ? status.toLowerCase() : "waiting";
        if (!List.of("waiting", "serving", "frozen", "missed", "completed").contains(st)) {
            st = "waiting";
        }

        Integer dailyNumber = "frozen".equals(st) ? null :
                jdbc.queryForObject(
                        "SELECT COALESCE(MAX(daily_number), 0) + 1 FROM tokens WHERE hospital_id = :hId AND category = :cat AND created_at::date = CURRENT_DATE",
                        Map.of("hId", hId, "cat", cat), Integer.class);

        Integer id = jdbc.queryForObject(
                """
                INSERT INTO tokens (name, age, gender, category, phone, hospital_id, status, daily_number,
                                   distance_km, travel_minutes, selected_travel_minutes, target_arrival_time, created_at)
                VALUES (:name, :age, :gender, :cat, :phone, :hId, :status, :dailyNumber,
                        :dist, :travelMins, :travelMins,
                        CASE WHEN :travelMins IS NOT NULL THEN NOW() + (:travelMins || ' minutes')::INTERVAL ELSE NULL END,
                        NOW())
                RETURNING id
                """,
                Map.of(
                        "name", (name != null && !name.isBlank()) ? name : "Ramesh Kumar (Demo)",
                        "age", age != null ? age : 28,
                        "gender", gender != null ? gender.toLowerCase() : "male",
                        "cat", cat,
                        "phone", cleanPhone,
                        "hId", hId,
                        "status", st,
                        "dailyNumber", dailyNumber != null ? dailyNumber : (Object) java.sql.Types.NULL,
                        "dist", distanceKm != null ? distanceKm : (Object) java.sql.Types.NULL,
                        "travelMins", travelMinutes != null ? travelMinutes : (Object) java.sql.Types.NULL
                ),
                Integer.class
        );

        log.info("🧪 Injected test token #{} with status '{}', distance {} km, travel {} mins", id, st, distanceKm, travelMinutes);
        return Map.of("id", id, "status", st, "dailyNumber", dailyNumber != null ? dailyNumber : 0);
    }
}
