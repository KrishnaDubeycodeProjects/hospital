package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CourseDocumentDto {
    private Integer id;
    private Integer courseId;
    private Integer encounterId;
    private String docType;
    private String fileName;
    private String contentType;
    private Integer fileSize;
    private String storagePath;
    private String fileHash;
    private Integer uploadedByDoctorId;
    private String uploadedByDoctorName;
    private String notes;
    private LocalDateTime createdAt;
}
