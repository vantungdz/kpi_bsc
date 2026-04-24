package com.company.kpi.response.reference;

import lombok.Data;

import java.util.UUID;

/**
 * User đang là {@code departments.manager_id} của ít nhất một đơn vị active —
 * dropdown «Giao KPI cascading» (thay cho lọc theo role PM).
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
