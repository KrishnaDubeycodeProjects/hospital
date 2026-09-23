package com.jansamvaad.asha.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class ReferralExpiryScanner {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    @Scheduled(fixedRate = 3600000)
    @Transactional
    public void scanExpiredReferrals() {
        log.info("Scanning for expired referrals...");
        String sql = "SELECT cr.*, c.patient_phone, c.family_member_id " +
                     "FROM clinicqueue.course_referrals cr " +
                     "JOIN clinicqueue.courses c ON cr.course_id = c.id " +
                     "WHERE cr.status = 'issued' AND cr.valid_until < CURRENT_DATE";
                     
        List<Map<String, Object>> expiredReferrals = jdbcTemplate.queryForList(sql, Map.of());
        int newTasksCreated = 0;
        
        for (Map<String, Object> referral : expiredReferrals) {
            try {
                Integer referralId = referral.get("id") != null ? ((Number) referral.get("id")).intValue() : null;
                if (referralId == null) continue;
                
                // Check if follow_up_task already exists
                String checkSql = "SELECT count(*) FROM clinicqueue.follow_up_tasks WHERE source_referral_id = :referralId";
                Integer count = jdbcTemplate.queryForObject(checkSql, Map.of("referralId", referralId), Integer.class);
                
                if (count != null && count == 0) {
                    String patientPhone = (String) referral.get("patient_phone");
                    Integer familyMemberId = referral.get("family_member_id") != null ? ((Number) referral.get("family_member_id")).intValue() : null;
                    Integer familyUnitId = null;
                    String ashaPhone = null;

                    if (familyMemberId != null) {
                        String getAshaByMember = "SELECT f.asha_worker_phone, f.id as family_unit_id FROM clinicqueue.family_units f JOIN clinicqueue.family_members fm ON f.id = fm.family_unit_id WHERE fm.id = :memberId LIMIT 1";
                        List<Map<String, Object>> result = jdbcTemplate.queryForList(getAshaByMember, Map.of("memberId", familyMemberId));
                        if (!result.isEmpty()) {
                            ashaPhone = (String) result.get(0).get("asha_worker_phone");
                            familyUnitId = ((Number) result.get(0).get("family_unit_id")).intValue();
                        }
                    } else if (patientPhone != null) {
                        String getAshaByPhone = "SELECT asha_worker_phone, id as family_unit_id FROM clinicqueue.family_units WHERE primary_phone = :phone LIMIT 1";
                        List<Map<String, Object>> result = jdbcTemplate.queryForList(getAshaByPhone, Map.of("phone", patientPhone));
                        if (!result.isEmpty()) {
                            ashaPhone = (String) result.get(0).get("asha_worker_phone");
                            familyUnitId = ((Number) result.get(0).get("family_unit_id")).intValue();
                        }
                    }
                    
                    if (ashaPhone != null) {
                        String reason = (String) referral.get("reason");
                        String insertTask = "INSERT INTO clinicqueue.follow_up_tasks (family_unit_id, asha_worker_phone, family_member_id, task_type, title, due_date, status, source_referral_id, created_at) " +
                                            "VALUES (:familyUnitId, :ashaPhone, :memberId, 'REFERRAL_MISSED', :title, CURRENT_DATE + 3, 'PENDING', :referralId, NOW())";
                        MapSqlParameterSource params = new MapSqlParameterSource()
                                .addValue("familyUnitId", familyUnitId)
                                .addValue("ashaPhone", ashaPhone)
                                .addValue("memberId", familyMemberId)
                                .addValue("title", "Missed referral: " + reason)
                                .addValue("referralId", referralId);
                        
                        jdbcTemplate.update(insertTask, params);
                        newTasksCreated++;
                    }
                }
            } catch (Exception ex) {
                log.warn("Error processing expired referral {}: {}", referral.get("id"), ex.getMessage());
            }
        }
        
        log.info("Referral scan completed. New tasks created: {}", newTasksCreated);
    }
}
