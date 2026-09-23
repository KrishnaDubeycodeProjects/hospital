package com.jansamvaad.asha.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SurveyTemplateDto {
    private Integer id;
    private String categoryCode;
    private String categoryLabel;
    private String categoryLabelHi;
    private String iconName;
    private Integer version;

    /**
     * JSONB questions array. Each question object:
     * { qid, text, text_hi, type, options: [{label, label_hi, value}], weight }
     */
    private List<Map<String, Object>> questions;
}
