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
    private LocalDateTime createdAt;
}
