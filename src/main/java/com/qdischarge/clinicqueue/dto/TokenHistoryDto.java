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
    private Integer counterId;
    private LocalDateTime createdAt;
    private LocalDateTime servedAt;
    private LocalDateTime completedAt;
    private LocalDateTime archivedAt;
}
