package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** A live (or revoked) doctor <-> patient-phone consent grant. Carries the doctor's name/hospital so a patient's access list is self-describing without a second lookup. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AccessGrantDto {
    private Integer id;
    private Integer doctorId;
    private String doctorName;
    private String hospitalName;
    private String patientPhone;
    private LocalDateTime grantedAt;
    private LocalDateTime revokedAt;
    /** 'patient' -- the only actor allowed to revoke today. */
    private String revokedBy;
}
