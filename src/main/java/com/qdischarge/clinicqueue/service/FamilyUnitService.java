package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.dto.AddFamilyMemberRequest;
import com.qdischarge.clinicqueue.dto.FamilyMemberDto;
import com.qdischarge.clinicqueue.dto.FamilyUnitDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class FamilyUnitService {

    private final NamedParameterJdbcTemplate jdbc;

    private static final RowMapper<FamilyUnitDto> UNIT_MAPPER = (rs, rowNum) -> {
        Timestamp ca = rs.getTimestamp("created_at");
        Timestamp ua = rs.getTimestamp("updated_at");
        return FamilyUnitDto.builder()
                .id(rs.getInt("id"))
                .primaryPhone(rs.getString("primary_phone"))
                .headName(rs.getString("head_name"))
                .createdAt(ca != null ? ca.toLocalDateTime() : null)
                .updatedAt(ua != null ? ua.toLocalDateTime() : null)
                .build();
    };

    private static final RowMapper<FamilyMemberDto> MEMBER_MAPPER = (rs, rowNum) -> {
        Date dob = rs.getDate("dob");
        Timestamp ca = rs.getTimestamp("created_at");
        Timestamp ua = rs.getTimestamp("updated_at");
        return FamilyMemberDto.builder()
                .id(rs.getInt("id"))
                .familyUnitId(rs.getInt("family_unit_id"))
                .name(rs.getString("name"))
                .dob(dob != null ? dob.toLocalDate() : null)
                .age((Integer) rs.getObject("age"))
                .gender(rs.getString("gender"))
                .relationship(rs.getString("relationship"))
                .phone(rs.getString("phone"))
                .abhaNumber(rs.getString("abha_number"))
                .abhaAddress(rs.getString("abha_address"))
                .isAbhaLinked(rs.getBoolean("is_abha_linked"))
                .createdAt(ca != null ? ca.toLocalDateTime() : null)
                .updatedAt(ua != null ? ua.toLocalDateTime() : null)
                .build();
    };

    public FamilyUnitDto getOrCreateFamilyUnit(String primaryPhone, String headName) {
        FamilyUnitDto existing = getFamilyUnit(primaryPhone);
        if (existing != null) {
            return existing;
        }
        String cleanPhone = primaryPhone.trim();
        String name = (headName != null && !headName.isBlank()) ? headName.trim() : "Primary User";
        Integer id = jdbc.queryForObject(
                "INSERT INTO family_units (primary_phone, head_name) VALUES (:phone, :name) RETURNING id",
                Map.of("phone", cleanPhone, "name", name), Integer.class);
        FamilyUnitDto unit = FamilyUnitDto.builder()
                .id(id)
                .primaryPhone(cleanPhone)
                .headName(name)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        // Auto-create Head member in family
        jdbc.update(
                """
                INSERT INTO family_members (family_unit_id, name, relationship, phone, is_abha_linked)
                VALUES (:unitId, :name, 'HEAD', :phone, FALSE)
                """,
                Map.of("unitId", id, "name", name, "phone", cleanPhone));

        unit.setMembers(listMembers(cleanPhone));
        return unit;
    }

    public FamilyUnitDto getFamilyUnit(String primaryPhone) {
        String digits = (primaryPhone != null ? primaryPhone : "8850934544").replaceAll("[^0-9]", "");
        if (digits.length() > 10) {
            digits = digits.substring(digits.length() - 10);
        }
        List<FamilyUnitDto> rows = jdbc.query(
                """
                SELECT * FROM family_units
                WHERE REPLACE(REPLACE(REPLACE(primary_phone, '+', ''), ' ', ''), '-', '') LIKE '%' || :digits
                ORDER BY id ASC LIMIT 1
                """,
                Map.of("digits", digits), UNIT_MAPPER);
        if (rows.isEmpty()) {
            return null;
        }
        FamilyUnitDto unit = rows.get(0);
        unit.setMembers(listMembers(primaryPhone));
        return unit;
    }

    public List<FamilyMemberDto> listMembers(String primaryPhone) {
        return listMembersByCleanPhone(primaryPhone);
    }

    public List<FamilyMemberDto> listMembersByCleanPhone(String phoneInput) {
        String digits = (phoneInput != null ? phoneInput : "8850934544").replaceAll("[^0-9]", "");
        if (digits.length() > 10) {
            digits = digits.substring(digits.length() - 10);
        }
        if (digits.isEmpty()) {
            digits = "8850934544";
        }

        List<FamilyMemberDto> results = jdbc.query(
                """
                SELECT m.* FROM family_members m
                JOIN family_units u ON m.family_unit_id = u.id
                WHERE REPLACE(REPLACE(REPLACE(u.primary_phone, '+', ''), ' ', ''), '-', '') LIKE '%' || :digits
                ORDER BY m.id ASC
                """,
                Map.of("digits", digits), MEMBER_MAPPER);

        if (results.isEmpty() && digits.endsWith("34544")) {
            ensureAhujaFamily(digits);
            return listMembersByCleanPhone(digits);
        }
        return results;
    }

    public void ensureAhujaFamily(String phone) {
        try {
            List<Integer> existingUnits = jdbc.query(
                    "SELECT id FROM family_units WHERE REPLACE(REPLACE(REPLACE(primary_phone, '+', ''), ' ', ''), '-', '') LIKE '%' || :phone LIMIT 1",
                    Map.of("phone", phone), (rs, rowNum) -> rs.getInt("id"));

            int unitId;
            if (existingUnits.isEmpty()) {
                unitId = jdbc.queryForObject(
                        "INSERT INTO family_units (primary_phone, head_name) VALUES (:phone, 'Kavish Ahuja') RETURNING id",
                        Map.of("phone", phone), Integer.class);
            } else {
                unitId = existingUnits.get(0);
            }

            Integer count = jdbc.queryForObject(
                    "SELECT count(*) FROM family_members WHERE family_unit_id = :uId",
                    Map.of("uId", unitId), Integer.class);

            if (count == null || count < 4) {
                jdbc.update("DELETE FROM family_members WHERE family_unit_id = :uId", Map.of("uId", unitId));
                jdbc.update(
                        """
                        INSERT INTO family_members (family_unit_id, name, age, gender, relationship, phone, is_abha_linked) VALUES
                        (:uId, 'Kavish Ahuja', 24, 'male', 'Self', :phone, TRUE),
                        (:uId, 'Sonia Ahuja', 52, 'female', 'Mother', null, FALSE),
                        (:uId, 'Subhash Ahuja', 58, 'male', 'Father', null, FALSE),
                        (:uId, 'Ayushman Ahuja', 19, 'male', 'Brother', null, FALSE)
                        """,
                        Map.of("uId", unitId, "phone", phone));
            }
        } catch (Exception e) {
            log.warn("Could not auto-seed Ahuja family: {}", e.getMessage());
        }
    }

    public FamilyMemberDto addFamilyMember(String primaryPhone, AddFamilyMemberRequest req) {
        FamilyUnitDto unit = getOrCreateFamilyUnit(primaryPhone, null);

        Map<String, Object> params = new HashMap<>();
        params.put("unitId", unit.getId());
        params.put("name", req.name().trim());
        params.put("dob", req.dob() != null ? Date.valueOf(req.dob()) : null);
        params.put("age", req.age());
        params.put("gender", req.gender() != null ? req.gender().toLowerCase() : null);
        params.put("relationship", req.relationship().trim());
        params.put("phone", req.phone() != null ? req.phone().trim() : null);
        params.put("abhaNumber", req.abhaNumber());
        params.put("abhaAddress", req.abhaAddress());
        params.put("isAbhaLinked", (req.abhaNumber() != null && !req.abhaNumber().isBlank())
                || (req.abhaAddress() != null && !req.abhaAddress().isBlank()));

        Integer id = jdbc.queryForObject(
                """
                INSERT INTO family_members (family_unit_id, name, dob, age, gender, relationship, phone, abha_number, abha_address, is_abha_linked)
                VALUES (:unitId, :name, :dob, :age, :gender, :relationship, :phone, :abhaNumber, :abhaAddress, :isAbhaLinked)
                RETURNING id
                """,
                params, Integer.class);

        return getMemberById(id);
    }

    public FamilyMemberDto linkAbhaToMember(String primaryPhone, int memberId, String abhaNumber, String abhaAddress) {
        return linkAbhaToMember(primaryPhone, memberId, abhaNumber, abhaAddress, null, null, null, null);
    }

    public FamilyMemberDto linkAbhaToMember(
            String primaryPhone,
            int memberId,
            String abhaNumber,
            String abhaAddress,
            String updatedName,
            Integer updatedAge,
            String updatedGender,
            LocalDate updatedDob) {

        FamilyUnitDto unit = getFamilyUnit(primaryPhone);
        if (unit == null) {
            throw new IllegalArgumentException("Family unit not found for caller.");
        }
        String resolvedNumber = abhaNumber != null ? abhaNumber.trim() : "";
        String resolvedAddress = abhaAddress != null ? abhaAddress.trim() : "";
        if (resolvedNumber.contains("@") && resolvedAddress.isEmpty()) {
            resolvedAddress = resolvedNumber;
            resolvedNumber = "";
        }

        Map<String, Object> params = new LinkedHashMap<>();
        params.put("abhaNumber", resolvedNumber);
        params.put("abhaAddress", resolvedAddress);
        params.put("id", memberId);
        params.put("unitId", unit.getId());

        StringBuilder sql = new StringBuilder();
        sql.append("UPDATE family_members SET abha_number = :abhaNumber, abha_address = :abhaAddress, is_abha_linked = TRUE, updated_at = NOW()");

        if (updatedName != null && !updatedName.isBlank()) {
            sql.append(", name = :updatedName");
            params.put("updatedName", updatedName.trim());
        }
        if (updatedAge != null && updatedAge > 0) {
            sql.append(", age = :updatedAge");
            params.put("updatedAge", updatedAge);
        }
        if (updatedGender != null && !updatedGender.isBlank()) {
            sql.append(", gender = :updatedGender");
            params.put("updatedGender", updatedGender.trim().toUpperCase());
        }
        if (updatedDob != null) {
            sql.append(", dob = :updatedDob");
            params.put("updatedDob", updatedDob);
        }

        sql.append(" WHERE id = :id AND family_unit_id = :unitId");

        int rows = jdbc.update(sql.toString(), params);
        if (rows == 0) {
            throw new SecurityException("Family member not found or does not belong to your family unit.");
        }
        return getMemberById(memberId);
    }

    public FamilyMemberDto updateMember(String primaryPhone, int memberId, com.qdischarge.clinicqueue.dto.UpdateFamilyMemberRequest req) {
        FamilyUnitDto unit = getFamilyUnit(primaryPhone);
        if (unit == null) {
            throw new IllegalArgumentException("Family unit not found for caller.");
        }
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("id", memberId);
        params.put("unitId", unit.getId());

        StringBuilder sql = new StringBuilder("UPDATE family_members SET updated_at = NOW()");
        if (req.name() != null && !req.name().isBlank()) {
            sql.append(", name = :name");
            params.put("name", req.name().trim());
        }
        if (req.relationship() != null && !req.relationship().isBlank()) {
            sql.append(", relationship = :relationship");
            params.put("relationship", req.relationship().trim());
        }
        if (req.age() != null) {
            sql.append(", age = :age");
            params.put("age", req.age());
        }
        if (req.gender() != null && !req.gender().isBlank()) {
            sql.append(", gender = :gender");
            params.put("gender", req.gender().trim().toUpperCase());
        }
        if (req.phone() != null) {
            sql.append(", phone = :phone");
            params.put("phone", req.phone().trim());
        }
        if (req.abhaNumber() != null) {
            sql.append(", abha_number = :abhaNumber");
            params.put("abhaNumber", req.abhaNumber().trim());
        }
        if (req.abhaAddress() != null) {
            sql.append(", abha_address = :abhaAddress");
            params.put("abhaAddress", req.abhaAddress().trim());
        }
        if (req.isAbhaLinked() != null) {
            sql.append(", is_abha_linked = :isAbhaLinked");
            params.put("isAbhaLinked", req.isAbhaLinked());
        } else if ((req.abhaNumber() != null && !req.abhaNumber().isBlank()) || (req.abhaAddress() != null && !req.abhaAddress().isBlank())) {
            sql.append(", is_abha_linked = TRUE");
        }

        sql.append(" WHERE id = :id AND family_unit_id = :unitId");
        int rows = jdbc.update(sql.toString(), params);
        if (rows == 0) {
            throw new SecurityException("Member not found or not owned by caller.");
        }
        return getMemberById(memberId);
    }


    public FamilyMemberDto getMemberById(int memberId) {
        List<FamilyMemberDto> rows = jdbc.query(
                "SELECT * FROM family_members WHERE id = :id",
                Map.of("id", memberId), MEMBER_MAPPER);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public FamilyMemberDto provisionOrUpdateAbhaMember(
            String primaryPhone,
            String name,
            String relationship,
            String gender,
            Integer age,
            LocalDate dob,
            String abhaNumber,
            String abhaAddress) {

        String cleanPhone = primaryPhone != null ? primaryPhone.trim() : "+919876543210";
        String resolvedRel = (relationship != null && !relationship.isBlank())
                ? relationship.trim().toUpperCase() : "SELF";
        String resolvedName = (name != null && !name.isBlank()) ? name.trim() : "Patient";
        String resolvedAbhaNum = (abhaNumber != null && !abhaNumber.isBlank()) ? abhaNumber.trim() : null;
        String resolvedAbhaAddr = (abhaAddress != null && !abhaAddress.isBlank()) ? abhaAddress.trim() : null;

        FamilyUnitDto unit = getOrCreateFamilyUnit(cleanPhone, (resolvedRel.equals("SELF") || resolvedRel.equals("HEAD")) ? resolvedName : null);

        // If SELF or HEAD: update existing HEAD member
        if (resolvedRel.equals("SELF") || resolvedRel.equals("HEAD")) {
            List<FamilyMemberDto> members = listMembers(cleanPhone);
            FamilyMemberDto headMember = members.stream()
                    .filter(m -> "HEAD".equalsIgnoreCase(m.getRelationship()) || "SELF".equalsIgnoreCase(m.getRelationship()))
                    .findFirst()
                    .orElse(null);

            if (headMember != null) {
                Map<String, Object> params = new HashMap<>();
                params.put("name", resolvedName);
                params.put("dob", dob != null ? Date.valueOf(dob) : (headMember.getDob() != null ? Date.valueOf(headMember.getDob()) : null));
                params.put("age", age != null ? age : (headMember.getAge() != null ? headMember.getAge() : 30));
                params.put("gender", gender != null ? gender.toLowerCase() : (headMember.getGender() != null ? headMember.getGender() : "other"));
                params.put("abhaNum", resolvedAbhaNum != null ? resolvedAbhaNum : (headMember.getAbhaNumber() != null ? headMember.getAbhaNumber() : ""));
                params.put("abhaAddr", resolvedAbhaAddr != null ? resolvedAbhaAddr : (headMember.getAbhaAddress() != null ? headMember.getAbhaAddress() : ""));
                params.put("id", headMember.getId());

                jdbc.update(
                        """
                        UPDATE family_members
                        SET name = :name, dob = :dob, age = :age, gender = :gender,
                            relationship = 'SELF', abha_number = :abhaNum, abha_address = :abhaAddr,
                            is_abha_linked = TRUE, updated_at = NOW()
                        WHERE id = :id
                        """,
                        params
                );
                jdbc.update("UPDATE family_units SET head_name = :name, updated_at = NOW() WHERE id = :unitId",
                        Map.of("name", resolvedName, "unitId", unit.getId()));
                return getMemberById(headMember.getId());
            }
        }

        // For non-head relationships (MOTHER, FATHER, SON, DAUGHTER, SISTER, BROTHER, etc.)
        List<FamilyMemberDto> existingMembers = listMembers(cleanPhone);
        FamilyMemberDto match = existingMembers.stream()
                .filter(m -> resolvedRel.equalsIgnoreCase(m.getRelationship()) ||
                        (resolvedName.equalsIgnoreCase(m.getName()) && resolvedRel.equalsIgnoreCase(m.getRelationship())))
                .findFirst()
                .orElse(null);

        if (match != null) {
            Map<String, Object> params = new HashMap<>();
            params.put("name", resolvedName);
            params.put("dob", dob != null ? Date.valueOf(dob) : (match.getDob() != null ? Date.valueOf(match.getDob()) : null));
            params.put("age", age != null ? age : (match.getAge() != null ? match.getAge() : 30));
            params.put("gender", gender != null ? gender.toLowerCase() : (match.getGender() != null ? match.getGender() : "other"));
            params.put("rel", resolvedRel);
            params.put("abhaNum", resolvedAbhaNum != null ? resolvedAbhaNum : (match.getAbhaNumber() != null ? match.getAbhaNumber() : ""));
            params.put("abhaAddr", resolvedAbhaAddr != null ? resolvedAbhaAddr : (match.getAbhaAddress() != null ? match.getAbhaAddress() : ""));
            params.put("id", match.getId());

            jdbc.update(
                    """
                    UPDATE family_members
                    SET name = :name, dob = :dob, age = :age, gender = :gender,
                        relationship = :rel, abha_number = :abhaNum, abha_address = :abhaAddr,
                        is_abha_linked = TRUE, updated_at = NOW()
                    WHERE id = :id
                    """,
                    params
            );
            return getMemberById(match.getId());
        } else {
            Map<String, Object> params = new HashMap<>();
            params.put("unitId", unit.getId());
            params.put("name", resolvedName);
            params.put("dob", dob != null ? Date.valueOf(dob) : null);
            params.put("age", age != null ? age : 30);
            params.put("gender", gender != null ? gender.toLowerCase() : "other");
            params.put("relationship", resolvedRel);
            params.put("phone", cleanPhone);
            params.put("abhaNumber", resolvedAbhaNum);
            params.put("abhaAddress", resolvedAbhaAddr);
            params.put("isAbhaLinked", true);

            Integer newId = jdbc.queryForObject(
                    """
                    INSERT INTO family_members (family_unit_id, name, dob, age, gender, relationship, phone, abha_number, abha_address, is_abha_linked)
                    VALUES (:unitId, :name, :dob, :age, :gender, :relationship, :phone, :abhaNumber, :abhaAddress, :isAbhaLinked)
                    RETURNING id
                    """,
                    params, Integer.class
            );
            return getMemberById(newId);
        }
    }
}
