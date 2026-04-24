package com.company.kpi.response.admin;

import lombok.Data;

/** DTO phòng ban (department) trả về cho Admin — dùng cho dropdown form */
@Data
public class AdminSectionResponse {
    private String id;
    private String name;
    private String parentId;
}
