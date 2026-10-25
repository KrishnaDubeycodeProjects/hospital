package com.qdischarge.clinicqueue.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Row/view of the "token_history" table: a permanent record of a completed
 * visit, archived by QueueManagerService the moment a token is marked
 * 'completed' (service actually finished). Lets one phone number's past
 * visits -- for potentially different patients (different name/age each
 * time) -- be looked up (GET /api/queue/history/{phone}) independently of
 * the live "tokens" table, which only tracks the current/active booking.
 * Also augmented with live queue fields (status, dailyNumber, tokenCode,
 * queuePosition, peopleAhead, familyMemberId, doctorName) when retrieved
 * via getPatientHistory to give a unified view across both active and completed visits.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TokenHistoryDto {
    private Integer id;
    private Integer tokenId;
    private String phone;
    private String name;
    private Integer age;
    private String gender;
    private String category;
    private Integer hospitalId;
    private String hospitalName;
    private Integer counterId;
    private String status;
    private Integer dailyNumber;
    private String tokenCode;
    private Integer queuePosition;
    private Integer peopleAhead;
    private Integer familyMemberId;
    private String doctorName;
    private LocalDateTime createdAt;
    private LocalDateTime servedAt;
    private LocalDateTime completedAt;
    private LocalDateTime archivedAt;
}
