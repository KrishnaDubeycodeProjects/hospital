package com.qdischarge.clinicqueue.dto;

public record UpdateFamilyMemberRequest(
        String name,
        String relationship,
        Integer age,
        String gender,
        String phone,
        String abhaNumber,
        String abhaAddress,
        Boolean isAbhaLinked
) {
}
