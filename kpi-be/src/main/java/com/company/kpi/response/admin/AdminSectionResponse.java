package com.company.kpi.response.admin;

import lombok.Data;

/** DTO phòng ban (department) trả về cho Admin — dùng cho dropdown form */
@Data
public class AdminSectionResponse {
    private String id;
    private String name;
    private String parentId;
    /** PM hiện tại của phòng (departments.manager_id). */
    private String managerId;
    private String managerName;
}
