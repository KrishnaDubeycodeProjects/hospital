package com.qdischarge.clinicqueue.dto;

import java.util.List;

/**
 * Request payload for the Doctor Portal "Complete & Next" consultation flow.
 * Consolidates encounter documentation, prescriptions, optional referral, and queue token completion.
 */
public record CompleteAndNextRequest(
        String chiefComplaint,
        String clinicalNotes,
        String examinationFindings,
        String plan,
        List<AddPrescriptionRequest> prescriptions,
        CreateReferralRequest referral,
        Integer currentTokenId
) {
}
