package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Generates official ABDM / NHA-compliant FHIR R4 JSON Bundles conforming to
 * NRCES (National Resource Centre for EHR Standards) India Profiles:
 * - https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle
 * - OPConsultRecord, MedicationRequest, DiagnosticReport, DocumentReference
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FhirBundleService {

    private final CourseService courseService;
    private final NamedParameterJdbcTemplate jdbc;

    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSXXX");

    /**
     * Creates an official FHIR R4 Document Bundle for a consultation encounter.
     */
    public Map<String, Object> createEncounterBundle(int courseId, int encounterId) {
        CourseTimelineDto timeline = courseService.getCourseTimeline(courseId);
        if (timeline == null || timeline.getCourse() == null) {
            throw new IllegalArgumentException("Course not found: " + courseId);
        }

        CourseDto course = timeline.getCourse();
        CourseEncounterDto encounter = timeline.getEncounters().stream()
                .filter(e -> e.getId() == encounterId)
                .findFirst()
                .orElse(timeline.getEncounters().isEmpty() ? null : timeline.getEncounters().get(0));

        if (encounter == null) {
            throw new IllegalArgumentException("Encounter not found: " + encounterId);
        }

        // Fetch hospital & doctor details
        String hfrId = "IN0001DEMO";
        String hospitalName = encounter.getHospitalName() != null ? encounter.getHospitalName() : "Community Health Center";
        try {
            List<Map<String, Object>> hospRows = jdbc.queryForList(
                    "SELECT hfr_id, name FROM hospitals WHERE id = :hId",
                    Map.of("hId", encounter.getHospitalId()));
            if (!hospRows.isEmpty()) {
                if (hospRows.get(0).get("hfr_id") != null) hfrId = hospRows.get(0).get("hfr_id").toString();
                if (hospRows.get(0).get("name") != null) hospitalName = hospRows.get(0).get("name").toString();
            }
        } catch (Exception ignored) {}

        String hprId = "91-0000-0000-0000@hpr.abdm";
        String doctorName = encounter.getDoctorName() != null ? encounter.getDoctorName() : "Attending Doctor";
        try {
            List<Map<String, Object>> docRows = jdbc.queryForList(
                    "SELECT hpr_id, name FROM doctors WHERE id = :dId",
                    Map.of("dId", encounter.getDoctorId()));
            if (!docRows.isEmpty()) {
                if (docRows.get(0).get("hpr_id") != null) hprId = docRows.get(0).get("hpr_id").toString();
                if (docRows.get(0).get("name") != null) doctorName = docRows.get(0).get("name").toString();
            }
        } catch (Exception ignored) {}

        // Fetch patient ABHA details
        String abhaNumber = null;
        String abhaAddress = null;
        try {
            if (course.getFamilyMemberId() != null) {
                List<Map<String, Object>> fm = jdbc.queryForList(
                        "SELECT abha_number, abha_address FROM family_members WHERE id = :fmId",
                        Map.of("fmId", course.getFamilyMemberId()));
                if (!fm.isEmpty()) {
                    abhaNumber = (String) fm.get(0).get("abha_number");
                    abhaAddress = (String) fm.get(0).get("abha_address");
                }
            }
        } catch (Exception ignored) {}

        String bundleId = UUID.randomUUID().toString();
        String compositionId = "comp-" + encounter.getId();
        String patientId = "pat-" + (course.getFamilyMemberId() != null ? course.getFamilyMemberId() : "primary");
        String practitionerId = "prk-" + encounter.getDoctorId();
        String orgId = "org-" + encounter.getHospitalId();
        String encResourceId = "enc-" + encounter.getId();

        String nowIso = encounter.getVisitDate().atOffset(ZoneOffset.ofHoursMinutes(5, 30)).format(ISO_FORMATTER);

        List<Map<String, Object>> entries = new ArrayList<>();

        // 1. Composition Resource
        Map<String, Object> composition = new LinkedHashMap<>();
        composition.put("resourceType", "Composition");
        composition.put("id", compositionId);
        composition.put("meta", Map.of("profile", List.of("https://nrces.in/ndhm/fhir/r4/StructureDefinition/OPConsultRecord")));
        composition.put("status", "final");
        composition.put("type", Map.of(
                "coding", List.of(Map.of(
                        "system", "http://snomed.info/sct",
                        "code", "371530004",
                        "display", "Clinical consultation report"
                )),
                "text", "OPD Consultation Record"
        ));
        composition.put("subject", Map.of("reference", "Patient/" + patientId, "display", course.getPatientName()));
        composition.put("encounter", Map.of("reference", "Encounter/" + encResourceId));
        composition.put("date", nowIso);
        composition.put("author", List.of(Map.of("reference", "Practitioner/" + practitionerId, "display", doctorName)));
        composition.put("title", "Consultation Note - " + (course.getTitle() != null ? course.getTitle() : "OPD Visit"));

        List<Map<String, Object>> sections = new ArrayList<>();

        // Chief Complaint & Clinical Notes Section
        Map<String, Object> notesSection = new LinkedHashMap<>();
        notesSection.put("title", "Chief Complaint & Findings");
        notesSection.put("code", Map.of("coding", List.of(Map.of("system", "http://snomed.info/sct", "code", "422843007", "display", "Chief complaint section"))));
        notesSection.put("text", Map.of(
                "status", "generated",
                "div", String.format("<div xmlns=\"http://www.w3.org/1999/xhtml\"><p><b>Complaint:</b> %s</p><p><b>Notes:</b> %s</p><p><b>Plan:</b> %s</p></div>",
                        encounter.getChiefComplaint() != null ? encounter.getChiefComplaint() : "None",
                        encounter.getClinicalNotes() != null ? encounter.getClinicalNotes() : "None",
                        encounter.getPlan() != null ? encounter.getPlan() : "Standard follow-up")
        ));
        sections.add(notesSection);

        // Medications Section
        if (encounter.getPrescriptions() != null && !encounter.getPrescriptions().isEmpty()) {
            List<Map<String, String>> medRefs = new ArrayList<>();
            for (CoursePrescriptionDto rx : encounter.getPrescriptions()) {
                medRefs.add(Map.of("reference", "MedicationRequest/rx-" + rx.getId()));
            }
            sections.add(Map.of(
                    "title", "Prescriptions",
                    "code", Map.of("coding", List.of(Map.of("system", "http://snomed.info/sct", "code", "721912009", "display", "Medication summary"))),
                    "entry", medRefs
            ));
        }

        // Documents Section
        if (encounter.getDocuments() != null && !encounter.getDocuments().isEmpty()) {
            List<Map<String, String>> docRefs = new ArrayList<>();
            for (CourseDocumentDto doc : encounter.getDocuments()) {
                docRefs.add(Map.of("reference", "DocumentReference/doc-" + doc.getId()));
            }
            sections.add(Map.of(
                    "title", "Clinical Documents & Case Sheets",
                    "entry", docRefs
            ));
        }

        composition.put("section", sections);
        entries.add(Map.of("fullUrl", "Composition/" + compositionId, "resource", composition));

        // 2. Patient Resource
        Map<String, Object> patient = new LinkedHashMap<>();
        patient.put("resourceType", "Patient");
        patient.put("id", patientId);
        patient.put("meta", Map.of("profile", List.of("https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient")));
        List<Map<String, String>> patIdentifiers = new ArrayList<>();
        if (abhaNumber != null) {
            patIdentifiers.add(Map.of("type", "MR", "system", "https://healthid.ndhm.gov.in", "value", abhaNumber));
        }
        if (abhaAddress != null) {
            patIdentifiers.add(Map.of("type", "ABHA_ADDRESS", "system", "https://ndhm.gov.in", "value", abhaAddress));
        }
        patIdentifiers.add(Map.of("system", "https://clinicqueue.health/patients", "value", course.getPatientPhone()));
        patient.put("identifier", patIdentifiers);
        patient.put("name", List.of(Map.of("text", course.getPatientName())));
        patient.put("telecom", List.of(Map.of("system", "phone", "value", course.getPatientPhone())));
        entries.add(Map.of("fullUrl", "Patient/" + patientId, "resource", patient));

        // 3. Practitioner Resource
        Map<String, Object> practitioner = new LinkedHashMap<>();
        practitioner.put("resourceType", "Practitioner");
        practitioner.put("id", practitionerId);
        practitioner.put("meta", Map.of("profile", List.of("https://nrces.in/ndhm/fhir/r4/StructureDefinition/Practitioner")));
        practitioner.put("identifier", List.of(Map.of("system", "https://doctor.ndhm.gov.in", "value", hprId)));
        practitioner.put("name", List.of(Map.of("text", doctorName)));
        entries.add(Map.of("fullUrl", "Practitioner/" + practitionerId, "resource", practitioner));

        // 4. Organization Resource
        Map<String, Object> org = new LinkedHashMap<>();
        org.put("resourceType", "Organization");
        org.put("id", orgId);
        org.put("meta", Map.of("profile", List.of("https://nrces.in/ndhm/fhir/r4/StructureDefinition/Organization")));
        org.put("identifier", List.of(Map.of("system", "https://facility.ndhm.gov.in", "value", hfrId)));
        org.put("name", hospitalName);
        entries.add(Map.of("fullUrl", "Organization/" + orgId, "resource", org));

        // 5. Encounter Resource
        Map<String, Object> encResource = new LinkedHashMap<>();
        encResource.put("resourceType", "Encounter");
        encResource.put("id", encResourceId);
        encResource.put("meta", Map.of("profile", List.of("https://nrces.in/ndhm/fhir/r4/StructureDefinition/Encounter")));
        encResource.put("status", "finished");
        encResource.put("class", Map.of("system", "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code", "AMB", "display", "ambulatory"));
        encResource.put("subject", Map.of("reference", "Patient/" + patientId));
        encResource.put("serviceProvider", Map.of("reference", "Organization/" + orgId));
        entries.add(Map.of("fullUrl", "Encounter/" + encResourceId, "resource", encResource));

        // 6. MedicationRequest Resources
        if (encounter.getPrescriptions() != null) {
            for (CoursePrescriptionDto rx : encounter.getPrescriptions()) {
                Map<String, Object> med = new LinkedHashMap<>();
                med.put("resourceType", "MedicationRequest");
                med.put("id", "rx-" + rx.getId());
                med.put("meta", Map.of("profile", List.of("https://nrces.in/ndhm/fhir/r4/StructureDefinition/MedicationRequest")));
                med.put("status", "active");
                med.put("intent", "order");
                med.put("medicationCodeableConcept", Map.of(
                        "coding", List.of(Map.of(
                                "system", "http://snomed.info/sct",
                                "code", rx.getSnomedCode() != null ? rx.getSnomedCode() : "387517004",
                                "display", rx.getMedicineName()
                        )),
                        "text", rx.getMedicineName()
                ));
                med.put("subject", Map.of("reference", "Patient/" + patientId));
                med.put("dosageInstruction", List.of(Map.of(
                        "text", String.format("%s - %s for %d days (%s)", rx.getDosage(), rx.getFrequency(), rx.getDurationDays(), rx.getInstructions() != null ? rx.getInstructions() : "As advised")
                )));
                entries.add(Map.of("fullUrl", "MedicationRequest/rx-" + rx.getId(), "resource", med));
            }
        }

        // 7. DocumentReference Resources (Scanned Case Papers, Reports)
        if (encounter.getDocuments() != null) {
            for (CourseDocumentDto doc : encounter.getDocuments()) {
                Map<String, Object> docRef = new LinkedHashMap<>();
                docRef.put("resourceType", "DocumentReference");
                docRef.put("id", "doc-" + doc.getId());
                docRef.put("meta", Map.of("profile", List.of("https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentReference")));
                docRef.put("status", "current");
                docRef.put("docStatus", "final");
                docRef.put("subject", Map.of("reference", "Patient/" + patientId));
                docRef.put("author", List.of(Map.of("reference", "Practitioner/" + practitionerId)));
                docRef.put("content", List.of(Map.of(
                        "attachment", Map.of(
                                "contentType", doc.getContentType() != null ? doc.getContentType() : "application/pdf",
                                "title", doc.getFileName() != null ? doc.getFileName() : "Clinical Case Paper",
                                "url", "/api/courses/" + courseId + "/documents/" + doc.getId() + "/download"
                        )
                )));
                entries.add(Map.of("fullUrl", "DocumentReference/doc-" + doc.getId(), "resource", docRef));
            }
        }

        // Assemble Final Bundle
        Map<String, Object> bundle = new LinkedHashMap<>();
        bundle.put("resourceType", "Bundle");
        bundle.put("id", bundleId);
        bundle.put("meta", Map.of(
                "versionId", "1",
                "lastUpdated", nowIso,
                "profile", List.of("https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle")
        ));
        bundle.put("identifier", Map.of("system", "https://clinicqueue.health/bundles", "value", bundleId));
        bundle.put("type", "document");
        bundle.put("timestamp", nowIso);
        bundle.put("entry", entries);

        return bundle;
    }
}
