package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** A doctor account: phone+OTP identity (see DoctorService), linked to at most one hospital via that hospital's join code. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DoctorDto {
    private Integer id;
    private String phone;
    private String name;
    private Integer hospitalId;
    /** Populated on joined reads (e.g. GET /api/doctors/me) -- null when the doctor hasn't linked a hospital yet. */
    private String hospitalName;
    /**
     * This doctor's assigned physical location within their hospital's queue
     * system -- a counter number, exactly like every other counter (see
     * CounterAssignmentService), plus which department (catalog.MedicalCategory)
     * that counter belongs to. Set by the hospital (admin), not the doctor --
     * see HospitalController's PUT .../doctors/{doctorId}/location.
     */
    private Integer counterId;
    private String category;
    private LocalDateTime createdAt;
}
