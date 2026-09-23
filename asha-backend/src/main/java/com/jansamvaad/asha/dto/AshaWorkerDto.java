package com.jansamvaad.asha.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AshaWorkerDto {
    private Integer id;
    private String phone;
    private String name;
    private String villageName;
    private String blockName;
    private String districtName;
    private Integer phcId;
    private String anmPhone;
    private Boolean isActive;
    private LocalDateTime createdAt;
}
