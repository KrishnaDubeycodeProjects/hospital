package com.jansamvaad.asha.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardDto {
    private int totalFamilies;
    private int totalMembers;
    private int surveysThisMonth;
    private int overdueFollowUps;
    private int upcomingFollowUps;
    private int pendingSyncCount;
    private String ashaName;
    private String villageName;
}
