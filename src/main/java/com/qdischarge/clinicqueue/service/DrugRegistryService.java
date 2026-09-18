package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.dto.DosageTemplateDto;
import com.qdischarge.clinicqueue.dto.DrugDto;
import com.qdischarge.clinicqueue.dto.LabTestDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DrugRegistryService {

    private final EkaCareAbdmService ekaCareAbdmService;

    private static final List<LabTestDto> STANDARD_LAB_REGISTRY = List.of(
            LabTestDto.builder().id("std_cbc").name("Complete Blood Count (CBC)").commonName("CBC with Differential").category("Hematology").sampleType("Whole Blood (EDTA)").isStandard(true).isLive(false).defaultTurnaroundHours(4).instructions("No special fasting required").build(),
            LabTestDto.builder().id("std_hb").name("Hemoglobin (Hb)").commonName("Hb Estimation").category("Hematology").sampleType("Whole Blood (EDTA)").isStandard(true).isLive(false).defaultTurnaroundHours(2).instructions("Routine test for anemia screening").build(),
            LabTestDto.builder().id("std_fbs").name("Fasting Blood Sugar (FBS)").commonName("Fasting Glucose").category("Biochemistry").sampleType("Fluoride Plasma").isStandard(true).isLive(false).defaultTurnaroundHours(2).instructions("Minimum 8-10 hours overnight fasting").build(),
            LabTestDto.builder().id("std_ppbs").name("Post Prandial Blood Sugar (PPBS)").commonName("2-Hour Post Meal Glucose").category("Biochemistry").sampleType("Fluoride Plasma").isStandard(true).isLive(false).defaultTurnaroundHours(2).instructions("Exactly 2 hours after start of major meal").build(),
            LabTestDto.builder().id("std_hba1c").name("Glycated Hemoglobin (HbA1c)").commonName("HbA1c (3-Month Average)").category("Biochemistry").sampleType("Whole Blood (EDTA)").isStandard(true).isLive(false).defaultTurnaroundHours(6).instructions("No fasting required").build(),
            LabTestDto.builder().id("std_lipid").name("Lipid Profile (Total Cholesterol, Triglycerides, HDL, LDL)").commonName("Lipid Panel").category("Biochemistry").sampleType("Serum").isStandard(true).isLive(false).defaultTurnaroundHours(6).instructions("10-12 hours overnight fasting recommended").build(),
            LabTestDto.builder().id("std_lft").name("Liver Function Tests (LFT - Bilirubin, SGOT, SGPT, ALP)").commonName("Liver Panel").category("Biochemistry").sampleType("Serum").isStandard(true).isLive(false).defaultTurnaroundHours(6).instructions("Avoid alcohol for 24 hours prior").build(),
            LabTestDto.builder().id("std_kft").name("Kidney Function Tests (KFT - Urea, Creatinine, Electrolytes)").commonName("Renal Function Panel").category("Biochemistry").sampleType("Serum").isStandard(true).isLive(false).defaultTurnaroundHours(6).instructions("Stay normally hydrated").build(),
            LabTestDto.builder().id("std_creat").name("Serum Creatinine").commonName("Creatinine").category("Biochemistry").sampleType("Serum").isStandard(true).isLive(false).defaultTurnaroundHours(4).instructions("Routine renal marker").build(),
            LabTestDto.builder().id("std_urine").name("Urine Routine & Microscopic Examination (R/M)").commonName("Urine Routine").category("Pathology").sampleType("Clean-Catch Midstream Urine").isStandard(true).isLive(false).defaultTurnaroundHours(2).instructions("Early morning first urine preferred").build(),
            LabTestDto.builder().id("std_sputum_afb").name("Sputum for AFB (Acid Fast Bacilli - TB Screening)").commonName("Sputum AFB (2 Samples)").category("Microbiology").sampleType("Deep Early Morning Sputum").isStandard(true).isLive(false).defaultTurnaroundHours(24).instructions("Rinse mouth with water, collect deep productive sputum").build(),
            LabTestDto.builder().id("std_malaria").name("Malaria Rapid Diagnostic Test (RDT) & Peripheral Smear").commonName("Malaria Antigen / Smear").category("Hematology").sampleType("Whole Blood").isStandard(true).isLive(false).defaultTurnaroundHours(1).instructions("STAT test during febrile spike").build(),
            LabTestDto.builder().id("std_dengue").name("Dengue NS1 Antigen & IgM/IgG Rapid").commonName("Dengue Duo Panel").category("Serology").sampleType("Serum").isStandard(true).isLive(false).defaultTurnaroundHours(2).instructions("Day 1-5 NS1, Day 5+ IgM antibody").build(),
            LabTestDto.builder().id("std_widal").name("Widal Slide Agglutination Test (Typhoid)").commonName("Widal Test").category("Serology").sampleType("Serum").isStandard(true).isLive(false).defaultTurnaroundHours(2).instructions("Recommended after Day 5-7 of continuous fever").build(),
            LabTestDto.builder().id("std_tsh").name("Thyroid Stimulating Hormone (TSH Ultrasensitive)").commonName("TSH").category("Endocrinology").sampleType("Serum").isStandard(true).isLive(false).defaultTurnaroundHours(8).instructions("Early morning fasting sample preferred").build(),
            LabTestDto.builder().id("std_xray_chest").name("Chest X-Ray PA View").commonName("Chest Radiograph PA").category("Radiology").sampleType("Diagnostic Imaging").isStandard(true).isLive(false).defaultTurnaroundHours(1).instructions("Remove metal ornaments and jewelry").build()
    );

    private static final List<DrugDto> DRUG_REGISTRY = List.of(

            // Antibiotics & Anti-infectives
            DrugDto.builder().name("Amoxicillin 500mg Capsule").genericName("Amoxicillin").brandName("Mox 500").form("Capsule").strength("500mg").snomedCode("27658006").isNlem(true).defaultDosage("1-0-1").defaultFrequency("Twice daily").defaultDurationDays(5).defaultInstructions("After food").build(),
            DrugDto.builder().name("Amoxicillin + Clavulanic Acid 625mg Tablet").genericName("Amoxicillin + Clavulanate").brandName("Augmentin 625").form("Tablet").strength("625mg").snomedCode("372687004").isNlem(true).defaultDosage("1-0-1").defaultFrequency("Twice daily").defaultDurationDays(5).defaultInstructions("After food").build(),
            DrugDto.builder().name("Azithromycin 500mg Tablet").genericName("Azithromycin").brandName("Azee 500").form("Tablet").strength("500mg").snomedCode("386884003").isNlem(true).defaultDosage("1-0-0").defaultFrequency("Once daily").defaultDurationDays(3).defaultInstructions("1 hr before or 2 hrs after food").build(),
            DrugDto.builder().name("Ciprofloxacin 500mg Tablet").genericName("Ciprofloxacin").brandName("Ciplox 500").form("Tablet").strength("500mg").snomedCode("387063009").isNlem(true).defaultDosage("1-0-1").defaultFrequency("Twice daily").defaultDurationDays(5).defaultInstructions("With full glass of water").build(),
            DrugDto.builder().name("Doxycycline 100mg Capsule").genericName("Doxycycline").brandName("Doxicip 100").form("Capsule").strength("100mg").snomedCode("387060007").isNlem(true).defaultDosage("1-0-1").defaultFrequency("Twice daily").defaultDurationDays(7).defaultInstructions("Take with plenty of water, do not lie down immediately").build(),

            // TB DOTS (Cat-I)
            DrugDto.builder().name("HRZE 4-FDC Tablet (Isoniazid 75mg + Rifampicin 150mg + Pyrazinamide 400mg + Ethambutol 275mg)").genericName("HRZE Fixed Dose Combination").brandName("Akurit-4").form("Tablet").strength("FDC").snomedCode("776587002").isNlem(true).defaultDosage("3-0-0").defaultFrequency("Once daily morning").defaultDurationDays(60).defaultInstructions("Empty stomach 30 mins before breakfast").build(),
            DrugDto.builder().name("HRE 3-FDC Tablet (Isoniazid 75mg + Rifampicin 150mg + Ethambutol 275mg)").genericName("HRE Fixed Dose Combination").brandName("Akurit-3").form("Tablet").strength("FDC").snomedCode("776588007").isNlem(true).defaultDosage("3-0-0").defaultFrequency("Once daily morning").defaultDurationDays(120).defaultInstructions("Empty stomach 30 mins before breakfast").build(),
            DrugDto.builder().name("Pyridoxine (Vit B6) 50mg Tablet").genericName("Pyridoxine").brandName("Benalgis").form("Tablet").strength("50mg").snomedCode("430469009").isNlem(true).defaultDosage("1-0-0").defaultFrequency("Once daily").defaultDurationDays(60).defaultInstructions("With food").build(),

            // Maternal & Child Health (ANC / Anemia)
            DrugDto.builder().name("Iron & Folic Acid (IFA) Tablet (100mg Elemental Iron + 500mcg Folic Acid)").genericName("Ferrous Sulfate + Folic Acid").brandName("IFA Large").form("Tablet").strength("100mg/500mcg").snomedCode("66493003").isNlem(true).defaultDosage("1-0-0").defaultFrequency("Once daily").defaultDurationDays(90).defaultInstructions("After food with water, avoid tea/coffee").build(),
            DrugDto.builder().name("Calcium + Vitamin D3 Tablet (500mg Elemental Calcium + 250 IU Vit D3)").genericName("Calcium Carbonate + Cholecalciferol").brandName("Shelcal 500").form("Tablet").strength("500mg/250IU").snomedCode("395951005").isNlem(true).defaultDosage("0-1-0").defaultFrequency("Once daily after lunch").defaultDurationDays(90).defaultInstructions("After food (separate from IFA by 2 hours)").build(),
            DrugDto.builder().name("Albendazole 400mg Tablet").genericName("Albendazole").brandName("Zentel 400").form("Chewable Tablet").strength("400mg").snomedCode("387289004").isNlem(true).defaultDosage("Single dose").defaultFrequency("Stat").defaultDurationDays(1).defaultInstructions("Chew thoroughly after meal").build(),

            // Cardiovascular & Hypertension
            DrugDto.builder().name("Amlodipine 5mg Tablet").genericName("Amlodipine").brandName("Amlokind 5").form("Tablet").strength("5mg").snomedCode("386864001").isNlem(true).defaultDosage("1-0-0").defaultFrequency("Once daily morning").defaultDurationDays(30).defaultInstructions("Fixed time daily").build(),
            DrugDto.builder().name("Telmisartan 40mg Tablet").genericName("Telmisartan").brandName("Telma 40").form("Tablet").strength("40mg").snomedCode("386868003").isNlem(true).defaultDosage("1-0-0").defaultFrequency("Once daily morning").defaultDurationDays(30).defaultInstructions("With or without food").build(),
            DrugDto.builder().name("Atenolol 50mg Tablet").genericName("Atenolol").brandName("Aten 50").form("Tablet").strength("50mg").snomedCode("386865000").isNlem(true).defaultDosage("1-0-0").defaultFrequency("Once daily").defaultDurationDays(30).defaultInstructions("Before breakfast").build(),

            // Diabetes / Endocrine
            DrugDto.builder().name("Metformin 500mg Tablet").genericName("Metformin").brandName("Glyciphage 500").form("Tablet").strength("500mg").snomedCode("372567009").isNlem(true).defaultDosage("1-0-1").defaultFrequency("Twice daily").defaultDurationDays(30).defaultInstructions("With or immediately after food").build(),
            DrugDto.builder().name("Glimepiride 1mg Tablet").genericName("Glimepiride").brandName("Amaryl 1").form("Tablet").strength("1mg").snomedCode("386847007").isNlem(true).defaultDosage("1-0-0").defaultFrequency("Once daily").defaultDurationDays(30).defaultInstructions("Just before breakfast").build(),

            // Analgesics, Antipyretics & Gastro
            DrugDto.builder().name("Paracetamol 650mg Tablet").genericName("Paracetamol").brandName("Dolo 650").form("Tablet").strength("650mg").snomedCode("387517004").isNlem(true).defaultDosage("1-1-1").defaultFrequency("Three times daily").defaultDurationDays(3).defaultInstructions("SOS / As needed for fever or pain").build(),
            DrugDto.builder().name("Pantoprazole 40mg Tablet").genericName("Pantoprazole").brandName("Pan 40").form("Tablet").strength("40mg").snomedCode("387498001").isNlem(true).defaultDosage("1-0-0").defaultFrequency("Once daily morning").defaultDurationDays(7).defaultInstructions("Empty stomach 30 mins before food").build(),
            DrugDto.builder().name("Oral Rehydration Salts (ORS) Sachet").genericName("Oral Rehydration Salts").brandName("Electral").form("Powder").strength("21.8g").snomedCode("387258003").isNlem(true).defaultDosage("As required").defaultFrequency("Frequent sips").defaultDurationDays(3).defaultInstructions("Dissolve entire sachet in 1 Litre of clean drinking water").build()
    );

    public List<DrugDto> search(String query) {
        if (query == null || query.isBlank()) {
            return DRUG_REGISTRY.stream().limit(10).toList();
        }

        // 1. Live Fetch from Eka Care Medical Database Registry
        try {
            List<DrugDto> liveResults = ekaCareAbdmService.searchLiveDrugs(query, 20);
            if (liveResults != null && !liveResults.isEmpty()) {
                return liveResults;
            }
        } catch (Exception e) {
            log.warn("Eka Care live drug search skipped, falling back to local registry: {}", e.getMessage());
        }

        // 2. Fallback to local NLEM essential medicines registry
        String q = query.trim().toLowerCase();
        return DRUG_REGISTRY.stream()
                .filter(d -> d.getName().toLowerCase().contains(q)
                        || d.getGenericName().toLowerCase().contains(q)
                        || (d.getBrandName() != null && d.getBrandName().toLowerCase().contains(q)))
                .limit(20)
                .toList();
    }

    /**
     * Searches diagnostic lab investigations prioritizing Eka Care Medical Database
     * with transparent fallback to standard clinical laboratory test panels.
     */
    public List<LabTestDto> searchLabs(String query) {
        if (query == null || query.isBlank()) {
            return STANDARD_LAB_REGISTRY.stream().limit(10).toList();
        }

        // 1. Live Fetch from Eka Care Medical Database Registry (s_type=lab)
        try {
            List<LabTestDto> liveResults = ekaCareAbdmService.searchLiveLabs(query, 20);
            if (liveResults != null && !liveResults.isEmpty()) {
                return liveResults;
            }
        } catch (Exception e) {
            log.warn("Eka Care live lab search skipped, falling back to local registry: {}", e.getMessage());
        }

        // 2. Fallback to local standard diagnostic lab catalog
        String q = query.trim().toLowerCase();
        return STANDARD_LAB_REGISTRY.stream()
                .filter(l -> l.getName().toLowerCase().contains(q)
                        || (l.getCommonName() != null && l.getCommonName().toLowerCase().contains(q))
                        || (l.getCategory() != null && l.getCategory().toLowerCase().contains(q)))
                .limit(20)
                .toList();
    }

    public boolean isValidDosage(String dosage) {
        if (dosage == null || dosage.isBlank()) return false;
        String d = dosage.trim();
        // Check standard 1-0-1, 1-0-0-1, etc pattern or recognized clinical keywords
        if (d.matches("^[0-9]+(-[0-9]+)+$")) return true;
        List<String> validKeywords = List.of("sos", "stat", "as required", "single dose", "as directed", "frequent sips");
        return validKeywords.stream().anyMatch(k -> d.toLowerCase().contains(k));
    }

    public DrugDto findBySnomedCode(String snomedCode) {
        if (snomedCode == null || snomedCode.isBlank()) return null;
        return DRUG_REGISTRY.stream()
                .filter(d -> snomedCode.equals(d.getSnomedCode()))
                .findFirst()
                .orElse(null);
    }

    public List<DosageTemplateDto> listTemplates() {
        List<DosageTemplateDto> templates = new ArrayList<>();

        // 1. Anemia Standard Template
        templates.add(DosageTemplateDto.builder()
                .id("tpl_anemia_std")
                .title("Iron Deficiency Anemia (Standard)")
                .conditionName("Iron Deficiency Anemia")
                .icd10Code("D50.9")
                .description("National protocol: Daily elemental iron + folic acid supplementation for 90 days with single-dose deworming.")
                .items(List.of(
                        findDrug("Iron & Folic Acid (IFA) Tablet"),
                        findDrug("Albendazole 400mg Tablet")
                ))
                .build());

        // 2. TB DOTS Cat-I Intensive Phase
        templates.add(DosageTemplateDto.builder()
                .id("tpl_tb_intensive")
                .title("Pulmonary TB (Cat-I Intensive Phase - 2 Months)")
                .conditionName("Pulmonary Tuberculosis")
                .icd10Code("A15.0")
                .description("NTEP standard intensive phase regimen: 4-drug FDC (HRZE) daily for 60 days + Pyridoxine.")
                .items(List.of(
                        findDrug("HRZE 4-FDC Tablet"),
                        findDrug("Pyridoxine (Vit B6) 50mg Tablet")
                ))
                .build());

        // 3. Hypertension Stage 1
        templates.add(DosageTemplateDto.builder()
                .id("tpl_htn_stage1")
                .title("Essential Hypertension (Initial Regimen)")
                .conditionName("Essential (Primary) Hypertension")
                .icd10Code("I10")
                .description("First-line antihypertensive therapy using calcium channel blocker or ARB with lifestyle modification.")
                .items(List.of(
                        findDrug("Amlodipine 5mg Tablet")
                ))
                .build());

        // 4. Acute Gastroenteritis / Dehydration
        templates.add(DosageTemplateDto.builder()
                .id("tpl_acute_ge")
                .title("Acute Gastroenteritis Rehydration")
                .conditionName("Gastroenteritis & Colitis")
                .icd10Code("A09")
                .description("WHO ORS protocol with symptomatic antipyretic relief.")
                .items(List.of(
                        findDrug("Oral Rehydration Salts (ORS) Sachet"),
                        findDrug("Paracetamol 650mg Tablet")
                ))
                .build());

        return templates;
    }

    private DrugDto findDrug(String partialName) {
        return DRUG_REGISTRY.stream()
                .filter(d -> d.getName().toLowerCase().contains(partialName.toLowerCase()))
                .findFirst()
                .orElse(null);
    }
}
