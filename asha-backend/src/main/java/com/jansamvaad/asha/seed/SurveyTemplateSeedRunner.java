package com.jansamvaad.asha.seed;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.postgresql.util.PGobject;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Types;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class SurveyTemplateSeedRunner implements ApplicationRunner {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        log.info("Checking survey_templates for seeding...");
        String countSql = "SELECT count(*) FROM clinicqueue.survey_templates";
        Integer count = jdbcTemplate.queryForObject(countSql, Map.of(), Integer.class);

        if (count != null && count == 0) {
            log.info("Seeding survey_templates...");
            seedTemplates();
        } else {
            log.info("survey_templates already seeded.");
        }

        try {
            String ashaCountSql = "SELECT count(*) FROM clinicqueue.asha_workers";
            Integer ashaCount = jdbcTemplate.queryForObject(ashaCountSql, Map.of(), Integer.class);
            if (ashaCount != null && ashaCount == 0) {
                log.info("Seeding default ASHA worker...");
                String insertAsha = "INSERT INTO clinicqueue.asha_workers (phone, name, village_name, block_name, district_name, phc_id, anm_phone, is_active, created_at, updated_at) " +
                                    "VALUES ('9876543210', 'Sunita Devi', 'Chandpur Village', 'Rampur Block', 'Varanasi', 1, '9876543211', true, NOW(), NOW())";
                jdbcTemplate.update(insertAsha, Map.of());
            }

            String anmCountSql = "SELECT count(*) FROM clinicqueue.anm_profiles";
            Integer anmCount = jdbcTemplate.queryForObject(anmCountSql, Map.of(), Integer.class);
            if (anmCount != null && anmCount == 0) {
                log.info("Seeding default ANM profile...");
                String insertAnm = "INSERT INTO clinicqueue.anm_profiles (phone, name, phc_name, qr_code_data, created_at) " +
                                   "VALUES ('9876543211', 'Rekha Sharma', 'Chandpur PHC', 'ANM-QR-9876543211', NOW())";
                jdbcTemplate.update(insertAnm, Map.of());
            }
        } catch (Exception e) {
            log.warn("Could not check/seed default ASHA/ANM workers: {}", e.getMessage());
        }
    }

    private void seedTemplates() throws Exception {
        String insertSql = "INSERT INTO clinicqueue.survey_templates (category_code, category_label, category_label_hi, icon_name, questions) " +
                           "VALUES (:code, :label, :labelHi, :icon, :questions)";

        // Template 1
        String t1Json = "[ " +
                "  {\"qid\":\"P01\",\"text\":\"Date of Last Menstrual Period?\",\"text_hi\":\"अंतिम माहवारी की तारीख?\",\"type\":\"date\",\"weight\":1}, " +
                "  {\"qid\":\"P02\",\"text\":\"Vaginal bleeding during pregnancy?\",\"text_hi\":\"योनि से खून?\",\"type\":\"single_choice\",\"weight\":1,\"options\":[{\"label\":\"None\",\"label_hi\":\"नहीं\",\"value\":\"none\"},{\"label\":\"Spotting\",\"label_hi\":\"हल्का\",\"value\":\"spotting\"},{\"label\":\"Heavy\",\"label_hi\":\"ज्यादा\",\"value\":\"heavy\"}]}, " +
                "  {\"qid\":\"P03\",\"text\":\"Facial/hand swelling or severe headache?\",\"text_hi\":\"सूजन या सिरदर्द?\",\"type\":\"single_choice\",\"weight\":1,\"options\":[{\"label\":\"None\",\"label_hi\":\"नहीं\",\"value\":\"none\"},{\"label\":\"Mild\",\"label_hi\":\"हल्का\",\"value\":\"mild\"},{\"label\":\"Severe\",\"label_hi\":\"गंभीर\",\"value\":\"severe\"}]}, " +
                "  {\"qid\":\"P04\",\"text\":\"Hemoglobin level (g/dL)?\",\"text_hi\":\"हीमोग्लोबिन?\",\"type\":\"number\",\"weight\":1}, " +
                "  {\"qid\":\"P05\",\"text\":\"Fetal movement felt normally?\",\"text_hi\":\"बच्चे की हलचल?\",\"type\":\"yes_no\",\"weight\":1}, " +
                "  {\"qid\":\"P06\",\"text\":\"Planned delivery location?\",\"text_hi\":\"प्रसव कहाँ?\",\"type\":\"single_choice\",\"weight\":1,\"options\":[{\"label\":\"Government Hospital\",\"label_hi\":\"सरकारी अस्पताल\",\"value\":\"govt\"},{\"label\":\"Private/Accredited\",\"label_hi\":\"निजी\",\"value\":\"private\"},{\"label\":\"Home\",\"label_hi\":\"घर\",\"value\":\"home\"}]}, " +
                "  {\"qid\":\"P07\",\"text\":\"Postnatal complications?\",\"text_hi\":\"प्रसव बाद समस्या?\",\"type\":\"multi_choice\",\"weight\":1,\"options\":[{\"label\":\"Excessive bleeding\",\"label_hi\":\"ज्यादा खून\",\"value\":\"bleeding\"},{\"label\":\"High fever\",\"label_hi\":\"तेज बुखार\",\"value\":\"fever\"},{\"label\":\"Convulsions\",\"label_hi\":\"दौरे\",\"value\":\"convulsions\"}]} " +
                "]";
        insertTemplate(insertSql, "PREGNANCY", "Pregnancy (ANC/PNC)", "गर्भावस्था", "pregnant-woman", t1Json);

        // Template 2
        String t2Json = "[ " +
                "  {\"qid\":\"D01\",\"text\":\"Age (completed years)?\",\"text_hi\":\"उम्र?\",\"type\":\"single_choice\",\"weight\":1,\"options\":[{\"label\":\"Below 30\",\"label_hi\":\"30 से कम\",\"value\":\"below_30\"},{\"label\":\"30-39\",\"label_hi\":\"30-39\",\"value\":\"30_39\"},{\"label\":\"40-49\",\"label_hi\":\"40-49\",\"value\":\"40_49\"},{\"label\":\"50+\",\"label_hi\":\"50+\",\"value\":\"50_plus\"}]}, " +
                "  {\"qid\":\"D02\",\"text\":\"Tobacco use?\",\"text_hi\":\"तंबाकू?\",\"type\":\"single_choice\",\"weight\":1,\"options\":[{\"label\":\"Never\",\"label_hi\":\"कभी नहीं\",\"value\":\"never\"},{\"label\":\"Past/Sometimes\",\"label_hi\":\"कभी-कभी\",\"value\":\"past\"},{\"label\":\"Daily\",\"label_hi\":\"रोज\",\"value\":\"daily\"}]}, " +
                "  {\"qid\":\"D03\",\"text\":\"Daily alcohol intake?\",\"text_hi\":\"रोजाना शराब?\",\"type\":\"yes_no\",\"weight\":1}, " +
                "  {\"qid\":\"D04\",\"text\":\"Waist circumference?\",\"text_hi\":\"कमर माप?\",\"type\":\"single_choice\",\"weight\":1,\"options\":[{\"label\":\"Normal\",\"label_hi\":\"सामान्य\",\"value\":\"normal\"},{\"label\":\"Moderate\",\"label_hi\":\"मध्यम\",\"value\":\"moderate\"},{\"label\":\"High\",\"label_hi\":\"ज्यादा\",\"value\":\"high\"}]}, " +
                "  {\"qid\":\"D05\",\"text\":\"Physical activity ≥150 min/week?\",\"text_hi\":\"व्यायाम?\",\"type\":\"yes_no\",\"weight\":1}, " +
                "  {\"qid\":\"D06\",\"text\":\"Family history of HTN/Diabetes/Heart disease?\",\"text_hi\":\"परिवार में रोग?\",\"type\":\"yes_no\",\"weight\":1}, " +
                "  {\"qid\":\"D07\",\"text\":\"Cough >2 weeks or blood in sputum?\",\"text_hi\":\"खांसी या खून?\",\"type\":\"multi_choice\",\"weight\":1,\"options\":[{\"label\":\"Cough >2 weeks\",\"label_hi\":\"2 हफ्ते से खांसी\",\"value\":\"cough\"},{\"label\":\"Blood in sputum\",\"label_hi\":\"बलगम में खून\",\"value\":\"blood\"},{\"label\":\"Night sweats\",\"label_hi\":\"रात को पसीना\",\"value\":\"sweats\"}]}, " +
                "  {\"qid\":\"D08\",\"text\":\"Skin patches with loss of sensation?\",\"text_hi\":\"सुन्न दाग?\",\"type\":\"yes_no\",\"weight\":1}, " +
                "  {\"qid\":\"D09\",\"text\":\"Non-healing oral ulcer or breast lump?\",\"text_hi\":\"घाव या गांठ?\",\"type\":\"yes_no\",\"weight\":1} " +
                "]";
        insertTemplate(insertSql, "DISEASE", "Disease Screening", "रोग जांच", "hospital", t2Json);

        // Template 3
        String t3Json = "[ " +
                "  {\"qid\":\"C01\",\"text\":\"Birth weight (grams)?\",\"text_hi\":\"जन्म वजन?\",\"type\":\"number\",\"weight\":1}, " +
                "  {\"qid\":\"C02\",\"text\":\"Current weight (kg)?\",\"text_hi\":\"वर्तमान वजन?\",\"type\":\"number\",\"weight\":1}, " +
                "  {\"qid\":\"C03\",\"text\":\"Bilateral edema or severe wasting?\",\"text_hi\":\"सूजन या सूखापन?\",\"type\":\"yes_no\",\"weight\":1}, " +
                "  {\"qid\":\"C04\",\"text\":\"Vaccines completed?\",\"text_hi\":\"टीके?\",\"type\":\"multi_choice\",\"weight\":1,\"options\":[{\"label\":\"BCG\",\"label_hi\":\"BCG\",\"value\":\"bcg\"},{\"label\":\"OPV\",\"label_hi\":\"OPV\",\"value\":\"opv\"},{\"label\":\"Pentavalent\",\"label_hi\":\"पेंटावैलेंट\",\"value\":\"pentavalent\"},{\"label\":\"Rotavirus\",\"label_hi\":\"रोटावायरस\",\"value\":\"rotavirus\"},{\"label\":\"MR\",\"label_hi\":\"MR\",\"value\":\"mr\"},{\"label\":\"DPT Booster\",\"label_hi\":\"DPT बूस्टर\",\"value\":\"dpt_booster\"}]}, " +
                "  {\"qid\":\"C05\",\"text\":\"Diarrhea symptoms?\",\"text_hi\":\"दस्त?\",\"type\":\"single_choice\",\"weight\":1,\"options\":[{\"label\":\"None\",\"label_hi\":\"नहीं\",\"value\":\"none\"},{\"label\":\"Watery <14 days\",\"label_hi\":\"पानी जैसा <14 दिन\",\"value\":\"watery_short\"},{\"label\":\"Dysentery (blood)\",\"label_hi\":\"खूनी दस्त\",\"value\":\"dysentery\"},{\"label\":\"Watery >14 days\",\"label_hi\":\"पानी जैसा >14 दिन\",\"value\":\"watery_long\"}]}, " +
                "  {\"qid\":\"C06\",\"text\":\"Acute Respiratory Infection signs?\",\"text_hi\":\"सांस तेज?\",\"type\":\"multi_choice\",\"weight\":1,\"options\":[{\"label\":\"Fast breathing\",\"label_hi\":\"तेज सांस\",\"value\":\"fast_breath\"},{\"label\":\"Chest indrawing\",\"label_hi\":\"छाती धंसना\",\"value\":\"chest_indraw\"},{\"label\":\"Unable to feed\",\"label_hi\":\"दूध नहीं पी पा रहा\",\"value\":\"cant_feed\"}]} " +
                "]";
        insertTemplate(insertSql, "CHILD", "Child & General Health", "बाल स्वास्थ्य", "child", t3Json);
    }

    private void insertTemplate(String insertSql, String code, String label, String labelHi, String icon, String json) throws Exception {
        List<?> questionsList = objectMapper.readValue(json, List.class);
        String finalJson = objectMapper.writeValueAsString(questionsList);

        PGobject pgObject = new PGobject();
        pgObject.setType("jsonb");
        pgObject.setValue(finalJson);

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("code", code)
                .addValue("label", label)
                .addValue("labelHi", labelHi)
                .addValue("icon", icon)
                .addValue("questions", pgObject, Types.OTHER);

        jdbcTemplate.update(insertSql, params);
        log.info("Inserted template: {} ({})", label, code);
    }
}
