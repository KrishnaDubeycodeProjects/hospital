package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.dto.AddFamilyMemberRequest;
import com.qdischarge.clinicqueue.dto.FamilyMemberDto;
import com.qdischarge.clinicqueue.dto.FamilyUnitDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class FamilyUnitServiceTest {

    private NamedParameterJdbcTemplate jdbc;
    private FamilyUnitService familyUnitService;

    @BeforeEach
    void setUp() {
        jdbc = mock(NamedParameterJdbcTemplate.class);
        familyUnitService = new FamilyUnitService(jdbc);
    }

    @Test
    void testGetOrCreateFamilyUnit_WhenNotExists_CreatesUnitAndHeadMember() {
        when(jdbc.query(contains("SELECT * FROM family_units WHERE primary_phone"), anyMap(), any(RowMapper.class)))
                .thenReturn(Collections.emptyList());
        when(jdbc.queryForObject(contains("INSERT INTO family_units"), anyMap(), eq(Integer.class)))
                .thenReturn(101);

        FamilyUnitDto result = familyUnitService.getOrCreateFamilyUnit("+919999999999", "Ramesh Kumar");

        assertNotNull(result);
        assertEquals(101, result.getId());
        assertEquals("+919999999999", result.getPrimaryPhone());
        assertEquals("Ramesh Kumar", result.getHeadName());

        // Verify HEAD member insertion
        verify(jdbc).update(contains("INSERT INTO family_members"), argThat((Map<String, ?> map) ->
                map.get("unitId").equals(101) && map.get("name").equals("Ramesh Kumar")
        ));
    }

    @Test
    void testAddFamilyMember_Success() {
        FamilyUnitDto existingUnit = FamilyUnitDto.builder().id(101).primaryPhone("+919999999999").headName("Ramesh Kumar").build();
        when(jdbc.query(contains("SELECT * FROM family_units WHERE primary_phone"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(existingUnit));

        AddFamilyMemberRequest req = new AddFamilyMemberRequest(
                "Sunita Kumar",
                LocalDate.of(1988, 5, 20),
                38,
                "female",
                "SPOUSE",
                null,
                "14-1234-5678-9012",
                "sunita@abdm"
        );

        when(jdbc.queryForObject(contains("INSERT INTO family_members"), anyMap(), eq(Integer.class)))
                .thenReturn(202);

        FamilyMemberDto savedMember = FamilyMemberDto.builder()
                .id(202)
                .familyUnitId(101)
                .name("Sunita Kumar")
                .relationship("SPOUSE")
                .isAbhaLinked(true)
                .build();

        when(jdbc.query(contains("SELECT * FROM family_members WHERE id"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(savedMember));

        FamilyMemberDto result = familyUnitService.addFamilyMember("+919999999999", req);

        assertNotNull(result);
        assertEquals(202, result.getId());
        assertEquals("Sunita Kumar", result.getName());
        assertTrue(result.getIsAbhaLinked());
    }

    @Test
    void testLinkAbhaToMember_EnforcesUnitOwnership_IdorProtection() {
        FamilyUnitDto callerUnit = FamilyUnitDto.builder().id(101).primaryPhone("+919999999999").build();
        when(jdbc.query(contains("SELECT * FROM family_units WHERE primary_phone"), anyMap(), any(RowMapper.class)))
                .thenReturn(List.of(callerUnit));

        // When member belongs to a DIFFERENT family unit, update affected rows is 0
        when(jdbc.update(contains("UPDATE family_members"), anyMap())).thenReturn(0);

        SecurityException ex = assertThrows(SecurityException.class, () ->
                familyUnitService.linkAbhaToMember("+919999999999", 999, "14-9999-9999-9999", "hacker@abdm")
        );

        assertTrue(ex.getMessage().contains("does not belong to your family unit"));
    }
}
