package com.qdischarge.clinicqueue.service;

import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.service.impl.FileSystemDocumentStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class DocumentStorageServiceTest {

    @TempDir
    Path tempStorageDir;

    private FileSystemDocumentStorageService storageService;

    @BeforeEach
    void setUp() {
        AppProperties props = new AppProperties();
        props.setStorageUploadDir(tempStorageDir.toString());
        props.setStorageMaxFileSizeMb(10);
        props.setStorageAllowedTypes("application/pdf,image/jpeg,image/png");

        storageService = new FileSystemDocumentStorageService(props);
        storageService.init();
    }

    @Test
    void testStoreFile_ValidPdf_Success() throws IOException {
        byte[] pdfBytes = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF".getBytes();
        MockMultipartFile file = new MockMultipartFile(
                "file", "blood_report.pdf", "application/pdf", pdfBytes);

        DocumentStorageService.StoredFile stored = storageService.storeFile(file, "course-12");

        assertNotNull(stored);
        assertNotNull(stored.storagePath());
        assertTrue(stored.storagePath().startsWith("course-12/"));
        assertEquals("blood_report.pdf", stored.fileName());
        assertEquals("application/pdf", stored.contentType());
        assertNotNull(stored.fileHash());
        assertEquals(64, stored.fileHash().length()); // SHA-256 hex string

        // Verify retrieval
        byte[] loaded = storageService.loadFile(stored.storagePath());
        assertArrayEquals(pdfBytes, loaded);

        // Verify deletion
        storageService.deleteFile(stored.storagePath());
        assertThrows(IOException.class, () -> storageService.loadFile(stored.storagePath()));
    }

    @Test
    void testStoreFile_DisguisedExecutable_RejectedByMagicBytes() {
        // Disguised as .pdf in filename and declared contentType, but content starts with 'MZ' (DOS/PE executable)
        byte[] exeBytes = "MZ\u0090\u0000\u0003\u0000\u0000\u0000\u0004\u0000\u0000\u0000\u00ff\u00ff\u0000\u0000This is an executable".getBytes();
        MockMultipartFile maliciousFile = new MockMultipartFile(
                "file", "scanned_document.pdf", "application/pdf", exeBytes);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                storageService.storeFile(maliciousFile, "course-12"));

        assertTrue(ex.getMessage().contains("Invalid file content signature"));
    }

    @Test
    void testStoreFile_EmptyFile_ThrowsException() {
        MockMultipartFile emptyFile = new MockMultipartFile(
                "file", "empty.pdf", "application/pdf", new byte[0]);

        assertThrows(IllegalArgumentException.class, () ->
                storageService.storeFile(emptyFile, "course-12"));
    }
}
