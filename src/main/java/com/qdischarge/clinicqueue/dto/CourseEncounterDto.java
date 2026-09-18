package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CourseEncounterDto {
    private Integer id;
    private Integer courseId;
    private Integer doctorId;
    private String doctorName;
    private Integer hospitalId;
    private String hospitalName;
    private LocalDateTime visitDate;
    private String chiefComplaint;
    private String clinicalNotes;
    private String examinationFindings;
    private String plan;
    private List<CoursePrescriptionDto> prescriptions;
    private List<CourseReferralDto> referrals;
    private List<CourseDocumentDto> documents;
    private LocalDateTime createdAt;
}
