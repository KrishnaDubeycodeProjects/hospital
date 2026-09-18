package com.qdischarge.clinicqueue.service;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

public interface DocumentStorageService {

    record StoredFile(String storagePath, String fileName, String contentType, long fileSize, String fileHash) {
    }

    StoredFile storeFile(MultipartFile file, String subDir) throws IOException;

    byte[] loadFile(String storagePath) throws IOException;

    void deleteFile(String storagePath) throws IOException;
}
