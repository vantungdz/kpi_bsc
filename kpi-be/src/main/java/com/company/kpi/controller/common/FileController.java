package com.company.kpi.controller.common;

import com.company.kpi.common.dto.BaseResponse;
import com.company.kpi.controller.base.BaseController;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1/upload")
public class FileController extends BaseController {

    private final Path uploadDir = Paths.get("uploads");

    public FileController() {
        try {
            if (!Files.exists(uploadDir)) {
                Files.createDirectories(uploadDir);
            }
        } catch (IOException e) {
            throw new RuntimeException("Could not create upload directory", e);
        }
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

            String fileDownloadUri = ServletUriComponentsBuilder.fromCurrentContextPath()
                    .path("/uploads/")
                    .path(newFilename)
                    .toUriString();

            return success(Map.of(
                    "url", fileDownloadUri,
                    "name", originalFilename != null ? originalFilename : newFilename
            ));
        } catch (IOException ex) {
            return ResponseEntity.internalServerError().body(BaseResponse.error("Could not store file"));
        }
    }
}
