package com.company.kpi.response.admin;

import lombok.Data;

/** DTO chức danh (job_titles) trả về cho Admin */
@Data
public class AdminJobTitleResponse {
    private String id;
    private String name;
    private String rankCode;
    private String jobFamilyCode;
    private String jobFamilyName;
}
