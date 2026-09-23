package com.jansamvaad.asha.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cho")
@RequiredArgsConstructor
@Slf4j
public class ChoAnalyticsController {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    @GetMapping("/analytics")
    public ResponseEntity<List<Map<String, Object>>> getAnalytics() {
        log.info("Fetching CHO analytics");
        String sql = "SELECT a.phone as asha_phone, a.name as asha_name, " +
                     "(SELECT count(*) FROM family_units f WHERE f.asha_worker_phone = a.phone) as family_count, " +
                     "(SELECT count(*) FROM survey_responses s WHERE s.asha_worker_phone = a.phone) as survey_count, " +
                     "(SELECT count(*) FROM follow_up_tasks t WHERE t.asha_worker_phone = a.phone AND t.task_type = 'REFERRAL_MISSED') as referral_missed_count " +
                     "FROM asha_workers a";
        List<Map<String, Object>> analytics = jdbcTemplate.queryForList(sql, Map.of());
        return ResponseEntity.ok(analytics);
    }
}
