package com.company.kpi.request.gm;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class UpdateDepartmentRequest {

    @NotBlank
    @Size(max = 255)
    private String name;

    private UUID parentId;
    private UUID managerId;
}
