package com.company.kpi.request.gm;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

/**
 * Tạo phòng ban — không có mã code (DB {@code departments} không có cột code).
 */
@Data
public class CreateDepartmentRequest {

    @NotBlank
    @Size(max = 255)
    private String name;

    private UUID parentId;
    private UUID managerId;
}
