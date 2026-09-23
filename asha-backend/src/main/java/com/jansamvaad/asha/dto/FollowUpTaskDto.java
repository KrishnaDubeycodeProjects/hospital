package com.jansamvaad.asha.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FollowUpTaskDto {
    private Integer id;
    private Integer familyUnitId;
    private Integer familyMemberId;
    private String ashaWorkerPhone;
    private String taskType;
    private String title;
    private String description;
    private LocalDate dueDate;
    private String status;
    private Integer sourceReferralId;
    private LocalDateTime completedAt;
    private String offlineId;
    private LocalDateTime createdAt;

    // Joined context for display
    private String memberName;
    private String familyHeadName;
    private String houseNumber;
}
