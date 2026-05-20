package com.company.kpi.controller.common;

import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Phục vụ file đã upload tại {@code /api/uploads/{storedName}} (không qua static handler).
 */
@RestController
@RequiredArgsConstructor
public class UploadedFileController {

    private final Path fileUploadPath;

    @GetMapping("/uploads/{storedName}")
    public ResponseEntity<Resource> serveUploadedFile(@PathVariable String storedName) {
        if (storedName.contains("..") || storedName.contains("/") || storedName.contains("\\")) {
            return ResponseEntity.badRequest().build();
        }
        try {
            Path file = fileUploadPath.resolve(storedName).normalize();
            if (!file.startsWith(fileUploadPath.normalize()) || !Files.exists(file)) {
                return ResponseEntity.notFound().build();
            }
            Resource resource = new UrlResource(file.toUri());
            String contentType = Files.probeContentType(file);
            MediaType mediaType = contentType != null
                    ? MediaType.parseMediaType(contentType)
                    : MediaType.APPLICATION_OCTET_STREAM;
            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + storedName + "\"")
                    .body(resource);
        } catch (MalformedURLException ex) {
            return ResponseEntity.internalServerError().build();
        } catch (Exception ex) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
