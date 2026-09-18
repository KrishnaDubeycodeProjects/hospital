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
public class FamilyUnitDto {
    private Integer id;
    private String primaryPhone;
    private String headName;
    private List<FamilyMemberDto> members;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
