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
import java.util.HashMap;
import java.util.LinkedHashMap;
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

        // 6. Ensure 10 specialized doctors exist
        String[][] doctorsList = {
            {"Dr. Rajesh Sharma", "+919888877777", "General Medicine", "1"},
            {"Dr. Priya Patel", "+919888877771", "Endocrinology", "2"},
            {"Dr. Vikram Malhotra", "+919888877772", "Orthopedics", "3"},
            {"Dr. Neha Kapoor", "+919888877773", "ENT", "4"},
            {"Dr. Amit Desai", "+919888877774", "Ophthalmology", "5"},
            {"Dr. Sunita Rao", "+919888877775", "Pulmonology", "6"},
            {"Dr. Arvind Menon", "+919888877776", "Neurology", "7"},
            {"Dr. Kavita Iyer", "+919888877778", "Gastroenterology", "8"},
            {"Dr. Sanjay Gupta", "+919888877779", "Dermatology", "9"},
            {"Dr. Meenakshi Sundaram", "+919888877780", "Nephrology", "10"}
        };
        for (String[] doc : doctorsList) {
            Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM doctors WHERE phone = :phone", Map.of("phone", doc[1]), Integer.class);
            if (count == null || count == 0) {
                jdbc.update(
                    "INSERT INTO doctors (name, phone, category, counter_id, hospital_id) VALUES (:name, :phone, :cat, :cid, :hid)",
                    Map.of("name", doc[0], "phone", doc[1], "cat", doc[2], "cid", Integer.parseInt(doc[3]), "hid", hospitalId)
                );
            }
        }

        // 7. Seed 10 Clinical Care Courses for Ramesh Kumar across doctors
        Integer courseCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM courses WHERE patient_phone IN (:phone, :digits)",
                Map.of("phone", cleanPhone, "digits", digitsOnly), Integer.class);

        if (courseCount == null || courseCount < 10) {
            String[][] courseDefinitions = {
                {"hypertension", "Hypertension & Cardiovascular Health", "Essential (primary) hypertension", "I10", "+919888877777", "Dr. Rajesh Sharma", "Stage 1 hypertension under active monitoring.", "Amlodipine 5mg", "Once daily (Night)", "BP 138/88 mmHg. 2D Echo recommended."},
                {"diabetes", "Type 2 Diabetes Mellitus Care", "Type 2 diabetes without complications", "E11.9", "+919888877771", "Dr. Priya Patel", "HbA1c 7.2%. Controlled with oral hypoglycemic agents.", "Metformin 500mg", "Twice daily with meals", "Maintain diabetic diet. HbA1c in 3 months."},
                {"orthopedics", "Lumbar Spondylosis & Spine Care", "Lumbosacral spondylosis without myelopathy", "M47.817", "+919888877772", "Dr. Vikram Malhotra", "Chronic lower back ache with morning stiffness.", "Aceclofenac 100mg + Paracetamol", "Twice daily SOS", "Core strengthening physiotherapy advised."},
                {"ent", "Chronic Rhinosinusitis & Allergy Course", "Chronic sinusitis, unspecified", "J32.9", "+919888877773", "Dr. Neha Kapoor", "Bilateral nasal congestion and frontal headache.", "Fluticasone Nasal Spray", "1 spray each nostril BD", "Steam inhalation twice daily."},
                {"ophthalmology", "Preventive Ophthalmic & Retinopathy Review", "Routine eye exam and refractive error", "Z01.00", "+919888877774", "Dr. Amit Desai", "Visual acuity 6/9 right, 6/6 left. Mild dry eye syndrome.", "Carboxymethylcellulose 0.5% Drops", "1 drop QID", "Anti-reflective glasses prescribed."},
                {"pulmonology", "Bronchial Airway & Cough Evaluation", "Mild persistent asthma", "J45.30", "+919888877775", "Dr. Sunita Rao", "Nocturnal dry cough and mild wheeze.", "Budesonide + Formoterol Inhaler", "2 puffs BD", "Peak flow monitoring advised."},
                {"neurology", "Tension Headache Prophylaxis", "Tension-type headache, chronic", "G44.22", "+919888877776", "Dr. Arvind Menon", "Bilateral band-like squeezing head pain.", "Amitriptyline 10mg", "Once daily at bedtime", "Regular sleep cycle & stress reduction."},
                {"gastroenterology", "GERD & Upper GI Care", "Gastro-esophageal reflux disease without esophagitis", "K21.9", "+919888877778", "Dr. Kavita Iyer", "Post-prandial heartburn and acid regurgitation.", "Rabeprazole 20mg", "Once daily 30m before breakfast", "Avoid late dinner & elevate head of bed."},
                {"dermatology", "Contact Dermatitis & Eczema Management", "Allergic contact dermatitis", "L23.9", "+919888877779", "Dr. Sanjay Gupta", "Pruritic erythematous plaques on forearms.", "Mometasone Furoate 0.1% Cream", "Apply topically BD", "Use mild soap and fragrance-free moisturizer."},
                {"nephrology", "Renal Function & Microalbuminuria Screening", "Microalbuminuria in hypertension", "R80.9", "+919888877780", "Dr. Meenakshi Sundaram", "Urine albumin-to-creatinine ratio screening within target.", "Telmisartan 40mg", "Once daily morning", "Repeat eGFR and spot urine ACR in 60 days."}
            };

            int startOffset = courseCount == null ? 0 : courseCount;
            for (int i = startOffset; i < courseDefinitions.length; i++) {
                String[] def = courseDefinitions[i];
                List<Integer> dIdList = jdbc.query("SELECT id FROM doctors WHERE phone = :p LIMIT 1", Map.of("p", def[4]), (rs, rowNum) -> rs.getInt("id"));
                int docId = dIdList.isEmpty() ? 1 : dIdList.get(0);
                int daysAgo = 3 + (i * 5);

                Integer cId = jdbc.queryForObject(
                        """
                        INSERT INTO courses (patient_phone, patient_name, family_member_id, course_type, title, diagnosis, icd10_code, status, started_by_doctor_id, started_at_hospital_id, current_summary, created_at, updated_at)
                        VALUES (:phone, 'Ramesh Kumar', :mId, :cType, :title, :diag, :icd, 'active', :docId, :hId, :summary, NOW() - (:days || ' days')::INTERVAL, NOW() - INTERVAL '1 day')
                        RETURNING id
                        """,
                        Map.of("phone", cleanPhone, "mId", rameshMemberId != null ? rameshMemberId : 1, "cType", def[0], "title", def[1], "diag", def[2], "icd", def[3], "docId", docId, "hId", hospitalId, "summary", def[6], "days", String.valueOf(daysAgo)),
                        Integer.class);

                if (cId != null) {
                    Integer encId = jdbc.queryForObject(
                            """
                            INSERT INTO course_encounters (course_id, doctor_id, hospital_id, visit_date, chief_complaint, clinical_notes, examination_findings, plan, created_at)
                            VALUES (:cId, :docId, :hId, NOW() - (:days || ' days')::INTERVAL, :complaint, :notes, :findings, :plan, NOW() - (:days || ' days')::INTERVAL)
                            RETURNING id
                            """,
                            Map.of("cId", cId, "docId", docId, "hId", hospitalId, "days", String.valueOf(daysAgo), "complaint", def[1] + " initial consultation", "notes", def[6], "findings", "Vitals stable, oriented.", "plan", def[9]),
                            Integer.class);

                    jdbc.update(
                            """
                            INSERT INTO course_prescriptions (course_id, encounter_id, doctor_id, medicine_name, snomed_code, dosage, frequency, duration_days, route, instructions, is_nlem, created_at)
                            VALUES (:cId, :encId, :docId, :med, '318445009', 'Standard', :freq, 30, 'Oral', :inst, TRUE, NOW() - (:days || ' days')::INTERVAL)
                            """,
                            Map.of("cId", cId, "encId", encId, "docId", docId, "med", def[7], "freq", def[8], "inst", def[9], "days", String.valueOf(daysAgo)));

                    if (i == 0) {
                        jdbc.update(
                                """
                                INSERT INTO course_referrals (course_id, encounter_id, referring_doctor_id, from_hospital_id, to_hospital_id, target_department, reason, priority_tier, valid_until, status, created_at)
                                VALUES (:cId, :encId, :docId, :hId, :hId, 'Cardiology', '2D Echocardiogram workup for persistent hypertension.', 'semi_urgent_14d', CURRENT_DATE + INTERVAL '14 days', 'issued', NOW() - INTERVAL '2 days')
                                """,
                                Map.of("cId", cId, "encId", encId, "docId", docId, "hId", hospitalId));
                    }
                }
            }
            log.info("🏥 Seeded 10 specialized care courses for {}", cleanPhone);
        }

        // 8. Seed 10 OPD Visit records in token_history for booking history view
        Integer historyCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM token_history WHERE phone IN (:phone, :digits)",
                Map.of("phone", cleanPhone, "digits", digitsOnly), Integer.class);
        if (historyCount == null || historyCount < 10) {
            String[] depts = {"General Medicine", "Endocrinology", "Orthopedics", "ENT", "Ophthalmology", "Pulmonology", "Neurology", "Gastroenterology", "Dermatology", "Nephrology"};
            for (int k = 0; k < depts.length; k++) {
                int daysAgo = 2 + (k * 7);
                jdbc.update(
                    """
                    INSERT INTO token_history (token_id, phone, name, age, gender, category, hospital_id, counter_id, created_at, served_at, completed_at)
                    VALUES (:tId, :phone, 'Ramesh Kumar', 28, 'male', :cat, :hId, :cId, NOW() - (:days || ' days')::INTERVAL - INTERVAL '40 minutes', NOW() - (:days || ' days')::INTERVAL - INTERVAL '15 minutes', NOW() - (:days || ' days')::INTERVAL)
                    """,
                    Map.of("tId", 8100 + k, "phone", cleanPhone, "cat", depts[k], "hId", hospitalId, "cId", (k % 4) + 1, "days", String.valueOf(daysAgo))
                );
            }
            log.info("📜 Seeded 10 past completed OPD visit history tokens for {}", cleanPhone);
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
        if (!List.of("waiting", "serving", "frozen", "reserved", "missed", "completed").contains(st)) {
            st = "waiting";
        }

        if ("frozen".equals(st)) {
            if (travelMinutes == null || travelMinutes <= 0) {
                travelMinutes = 45;
            }
            if (distanceKm == null || distanceKm <= 0) {
                distanceKm = 18.5;
            }
        }

        Integer activeMax = jdbc.queryForObject(
                """
                SELECT COALESCE(MAX(daily_number), 0) FROM tokens
                WHERE hospital_id = :hId AND LOWER(TRIM(category)) = LOWER(TRIM(:cat))
                  AND created_at::date = CURRENT_DATE
                """,
                Map.of("hId", hId, "cat", cat), Integer.class);
        int nextNum = (activeMax != null && activeMax > 0) ? (activeMax + 1) : 1;
        Integer dailyNumber = "frozen".equals(st) ? null : nextNum;

        String deptPrefix = "AF";
        if (cat != null && !cat.isBlank()) {
            String clean = cat.replaceAll("[^a-zA-Z]", " ").trim();
            String[] parts = clean.split("\\s+");
            if (parts.length >= 2) {
                deptPrefix = "AF-" + ("" + parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
            } else if (parts.length == 1 && parts[0].length() >= 2) {
                deptPrefix = "AF-" + parts[0].substring(0, 2).toUpperCase();
            } else if (parts.length == 1 && parts[0].length() == 1) {
                deptPrefix = "AF-" + parts[0].toUpperCase();
            }
        }
        String tokenCode = String.format("%s%02d", deptPrefix.contains("-") ? deptPrefix : deptPrefix + "-", nextNum);

        Map<String, Object> tokenParams = new HashMap<>();
        tokenParams.put("name", (name != null && !name.isBlank()) ? name : "Ramesh Kumar (Demo)");
        tokenParams.put("age", age != null ? age : 28);
        tokenParams.put("gender", gender != null ? gender.toLowerCase() : "male");
        tokenParams.put("cat", cat);
        tokenParams.put("phone", cleanPhone);
        tokenParams.put("hId", hId);
        tokenParams.put("status", st);
        tokenParams.put("dailyNumber", dailyNumber != null ? dailyNumber : (Object) java.sql.Types.NULL);
        tokenParams.put("dist", distanceKm != null ? distanceKm : (Object) java.sql.Types.NULL);
        tokenParams.put("travelMins", travelMinutes != null ? travelMinutes : (Object) java.sql.Types.NULL);
        tokenParams.put("tokenCode", tokenCode);

        Integer id = jdbc.queryForObject(
                """
                INSERT INTO tokens (name, age, gender, category, phone, hospital_id, status, daily_number,
                                   distance_km, travel_minutes, selected_travel_minutes, target_arrival_time, token_code, created_at)
                VALUES (:name, :age, :gender, :cat, :phone, :hId, :status, :dailyNumber,
                        :dist, :travelMins, :travelMins,
                        CASE WHEN :travelMins IS NOT NULL THEN NOW() + (:travelMins || ' minutes')::INTERVAL ELSE NULL END,
                        :tokenCode,
                        NOW())
                RETURNING id
                """,
                tokenParams,
                Integer.class
        );

        log.info("?? Injected test token #{} with status '{}', distance {} km, travel {} mins, code {}", id, st, distanceKm, travelMinutes, tokenCode);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("id", id);
        res.put("tokenId", id);
        res.put("status", st);
        res.put("dailyNumber", dailyNumber != null ? dailyNumber : nextNum);
        res.put("tokenCode", tokenCode);
        return res;
    }
}