package com.qdischarge.clinicqueue.service.impl;

import com.qdischarge.clinicqueue.config.AppProperties;
import com.qdischarge.clinicqueue.service.DocumentStorageService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class FileSystemDocumentStorageService implements DocumentStorageService {

    private final AppProperties appProperties;
    private final Tika tika = new Tika();

    private Path rootLocation;
    private Set<String> allowedMimeTypes;

    @PostConstruct
    public void init() {
        String uploadDir = appProperties.getStorageUploadDir();
        if (uploadDir == null || uploadDir.isBlank()) {
            uploadDir = "./storage/documents";
        }
        this.rootLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.rootLocation);
            log.info("Initialized document storage directory at: {}", this.rootLocation);
        } catch (IOException e) {
            log.error("Could not initialize storage directory: {}", e.getMessage());
            throw new RuntimeException("Could not initialize document storage location", e);
        }

        String allowed = appProperties.getStorageAllowedTypes();
        if (allowed == null || allowed.isBlank()) {
            allowed = "application/pdf,image/jpeg,image/png";
        }
        this.allowedMimeTypes = new HashSet<>(Arrays.stream(allowed.split(","))
                .map(String::trim)
                .map(String::toLowerCase)
                .filter(s -> !s.isEmpty())
                .toList());
    }

    @Override
    public StoredFile storeFile(MultipartFile file, String subDir) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Cannot store empty or null file.");
        }

        long maxBytes = (long) appProperties.getStorageMaxFileSizeMb() * 1024 * 1024;
        if (maxBytes > 0 && file.getSize() > maxBytes) {
            throw new IllegalArgumentException(String.format("File exceeds maximum allowed size of %d MB", appProperties.getStorageMaxFileSizeMb()));
        }

        // Detect real MIME type using Apache Tika magic bytes
        String detectedMimeType;
        try (InputStream is = file.getInputStream()) {
            detectedMimeType = tika.detect(is, file.getOriginalFilename());
        }

        if (detectedMimeType == null || !allowedMimeTypes.contains(detectedMimeType.toLowerCase())) {
            throw new IllegalArgumentException(String.format(
                    "Invalid file content signature. Detected MIME type '%s' is not in allowed list (%s).",
                    detectedMimeType, allowedMimeTypes));
        }

        // Compute SHA-256 hash and read bytes
        byte[] bytes = file.getBytes();
        String sha256Hash = computeSha256(bytes);

        // Sanitize original filename
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            originalFilename = "document";
        }
        String cleanOriginalName = Paths.get(originalFilename).getFileName().toString().replaceAll("[^a-zA-Z0-9._-]", "_");

        String extension = "";
        int dotIndex = cleanOriginalName.lastIndexOf('.');
        if (dotIndex > 0) {
            extension = cleanOriginalName.substring(dotIndex);
        } else if ("application/pdf".equalsIgnoreCase(detectedMimeType)) {
            extension = ".pdf";
        } else if ("image/jpeg".equalsIgnoreCase(detectedMimeType)) {
            extension = ".jpg";
        } else if ("image/png".equalsIgnoreCase(detectedMimeType)) {
            extension = ".png";
        }

        String safeSubDir = (subDir != null && !subDir.isBlank()) ? Paths.get(subDir).getFileName().toString() : "general";
        Path targetDir = this.rootLocation.resolve(safeSubDir).normalize();
        if (!targetDir.startsWith(this.rootLocation)) {
            throw new SecurityException("Cannot store file outside current storage root directory.");
        }
        Files.createDirectories(targetDir);

        String storedFileName = UUID.randomUUID() + extension;
        Path targetPath = targetDir.resolve(storedFileName).normalize();
        if (!targetPath.startsWith(this.rootLocation)) {
            throw new SecurityException("Cannot store file outside current storage root directory.");
        }

        Files.write(targetPath, bytes);

        // Relative storage path stored in DB
        String relativeStoragePath = safeSubDir + "/" + storedFileName;
        return new StoredFile(relativeStoragePath, cleanOriginalName, detectedMimeType, file.getSize(), sha256Hash);
    }

    @Override
    public byte[] loadFile(String storagePath) throws IOException {
        if (storagePath == null || storagePath.isBlank()) {
            throw new IllegalArgumentException("Storage path cannot be blank.");
        }

        Path file = this.rootLocation.resolve(storagePath).normalize();
        if (!file.startsWith(this.rootLocation)) {
            throw new SecurityException("Cannot access file outside current storage root directory.");
        }

        if (!Files.exists(file) || !Files.isReadable(file)) {
            throw new FileNotFoundException("File not found or unreadable: " + storagePath);
        }

        return Files.readAllBytes(file);
    }

    @Override
    public void deleteFile(String storagePath) throws IOException {
        if (storagePath == null || storagePath.isBlank()) {
            return;
        }

        Path file = this.rootLocation.resolve(storagePath).normalize();
        if (!file.startsWith(this.rootLocation)) {
            throw new SecurityException("Cannot access file outside current storage root directory.");
        }

        Files.deleteIfExists(file);
    }

    private String computeSha256(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data);
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }
}
