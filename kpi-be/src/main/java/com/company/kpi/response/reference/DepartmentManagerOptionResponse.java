package com.company.kpi.response.reference;

import lombok.Data;

import java.util.UUID;

/**
 * User active có role PM — dropdown gán manager department / giao KPI cascading.
 * {@link #managingDepartmentsLabel} gộp tên các department user đang là {@code manager_id} (nếu có).
 */
@Data
public class DepartmentManagerOptionResponse {

    private UUID id;
    private String username;
    private String email;
    private String fullName;
    /** Tên các department (gộp) mà user là manager. */
    private String managingDepartmentsLabel;
}
