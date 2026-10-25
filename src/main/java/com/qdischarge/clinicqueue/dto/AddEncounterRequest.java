package com.qdischarge.clinicqueue.dto;

import java.util.List;

public record AddEncounterRequest(
        Integer courseId,
        String chiefComplaint,
        String clinicalNotes,
        String examinationFindings,
        String plan,
        List<AddPrescriptionRequest> prescriptions
) {
}
