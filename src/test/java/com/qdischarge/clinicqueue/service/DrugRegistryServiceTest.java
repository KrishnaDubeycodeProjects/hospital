package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.dto.DosageTemplateDto;
import com.qdischarge.clinicqueue.dto.DrugDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.*;

class DrugRegistryServiceTest {

    private DrugRegistryService drugRegistryService;
    private EkaCareAbdmService ekaCareAbdmService;

    @BeforeEach
    void setUp() {
        ekaCareAbdmService = Mockito.mock(EkaCareAbdmService.class);
        drugRegistryService = new DrugRegistryService(ekaCareAbdmService);
    }

    @Test
    void testSearchDrugs() {
        List<DrugDto> amoxResults = drugRegistryService.search("amox");
        assertFalse(amoxResults.isEmpty());
        assertTrue(amoxResults.stream().anyMatch(d -> d.getName().contains("Amoxicillin")));
        assertTrue(amoxResults.stream().allMatch(DrugDto::getIsNlem));

        List<DrugDto> tbResults = drugRegistryService.search("HRZE");
        assertFalse(tbResults.isEmpty());
        assertEquals("776587002", tbResults.get(0).getSnomedCode());
    }

    @Test
    void testListTemplates() {
        List<DosageTemplateDto> templates = drugRegistryService.listTemplates();
        assertNotNull(templates);
        assertTrue(templates.size() >= 4);

        DosageTemplateDto anemia = templates.stream()
                .filter(t -> t.getId().equals("tpl_anemia_std"))
                .findFirst()
                .orElse(null);
        assertNotNull(anemia);
        assertEquals("Iron Deficiency Anemia", anemia.getConditionName());
        assertEquals(2, anemia.getItems().size());
    }

    @Test
    void testSearchLabs_Fallback() {
        var cbcResults = drugRegistryService.searchLabs("CBC");
        assertFalse(cbcResults.isEmpty());
        assertTrue(cbcResults.stream().anyMatch(l -> l.getName().contains("Complete Blood Count")));

        var lftResults = drugRegistryService.searchLabs("liver");
        assertFalse(lftResults.isEmpty());
        assertTrue(lftResults.stream().anyMatch(l -> l.getName().contains("Liver Function Tests")));
    }
}
