package com.company.kpi.response.admin;

import lombok.Data;

@Data
public class AdminEmployeeResponse {

    private String id;
    /** username được dùng làm mã nhân viên */
    private String code;
    private String name;
    private String email;
    private String section;
    private String rank;
    private String jobTitle;
    private String jobTitleId;
    /** Giá trị: "active" | "inactive" */
    private String status;
}
