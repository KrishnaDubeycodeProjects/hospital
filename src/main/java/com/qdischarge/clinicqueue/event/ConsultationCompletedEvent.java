package com.qdischarge.clinicqueue.event;

import com.qdischarge.clinicqueue.dto.CourseEncounterDto;
import com.qdischarge.clinicqueue.dto.ReferralDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConsultationCompletedEvent {
    private int courseId;
    private String patientPhone;
    private String patientName;
    private CourseEncounterDto encounter;
    private ReferralDto referral;
    private String frontendUrl;
}
