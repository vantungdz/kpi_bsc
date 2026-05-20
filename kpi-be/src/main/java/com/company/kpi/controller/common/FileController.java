package com.company.kpi.controller.common;

import com.company.kpi.common.dto.BaseResponse;
import com.company.kpi.controller.base.BaseController;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1/upload")
@RequiredArgsConstructor
public class FileController extends BaseController {

    private final Path uploadDir;

    private Path resolveStoredFile(String storedName) {
        if (storedName == null || storedName.isBlank()
                || storedName.contains("..") || storedName.contains("/") || storedName.contains("\\")) {
            return null;
        }
        Path file = uploadDir.resolve(storedName).normalize();
        if (!file.startsWith(uploadDir.normalize())) {
            return null;
        }
        return file;
    }

    @PostMapping
    public ResponseEntity<BaseResponse<Map<String, String>>> uploadFile(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(BaseResponse.error("File is empty"));
        }

        try {
            String originalFilename = file.getOriginalFilename();
            String extension = originalFilename != null && originalFilename.contains(".")
                    ? originalFilename.substring(originalFilename.lastIndexOf("."))
                    : "";
            String newFilename = UUID.randomUUID().toString() + extension;

            Path targetLocation = uploadDir.resolve(newFilename);
            Files.copy(file.getInputStream(), targetLocation);

            // Relative URL — same origin qua nginx/proxy, tránh CORS khi FE chạy port 8000/3000.
            String fileDownloadUri = "/api/uploads/" + newFilename;

            return success(Map.of(
                    "url", fileDownloadUri,
                    "name", originalFilename != null ? originalFilename : newFilename,
                    "storedName", newFilename
            ));
        } catch (IOException ex) {
            return ResponseEntity.internalServerError().body(BaseResponse.error("Could not store file"));
        }
    }

    /** Tải file minh chứng (qua API, hoạt động ổn định với Docker/nginx). */
    @GetMapping("/download/{storedName}")
    public ResponseEntity<Resource> downloadFile(
            @PathVariable String storedName,
            @RequestParam(value = "as", required = false) String downloadAs) {
        Path file = resolveStoredFile(storedName);
        if (file == null) {
            return ResponseEntity.badRequest().build();
        }
        try {
            if (!Files.exists(file)) {
                return ResponseEntity.notFound().build();
            }
            Resource resource = new UrlResource(file.toUri());
            String displayName = (downloadAs != null && !downloadAs.isBlank()) ? downloadAs.trim() : storedName;
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + displayName + "\"")
                    .body(resource);
        } catch (MalformedURLException ex) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /** Xóa file minh chứng đã upload khỏi thư mục lưu trữ (chỉ file nội bộ `/uploads/`). */
    @DeleteMapping("/{storedName}")
    public ResponseEntity<BaseResponse<Void>> deleteUploadedFile(@PathVariable String storedName) {
        Path file = resolveStoredFile(storedName);
        if (file == null) {
            return ResponseEntity.badRequest().body(BaseResponse.error("Invalid file name"));
        }
        try {
            Files.deleteIfExists(file);
            return success(null);
        } catch (IOException ex) {
            return ResponseEntity.internalServerError().body(BaseResponse.error("Could not delete file"));
        }
    }
}
