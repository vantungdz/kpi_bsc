package com.company.kpi.response.admin;

import lombok.Data;

@Data
public class AdminEmailTemplateResponse {

    private String id;
    private String name;
    private String subject;
    private String body;
    /** Giá trị: "active" | "inactive" */
    private String status;
    /** Giá trị: "manual" | "auto" */
    private String mode;
    /** Giá trị: "launch" | "reminder" | "approval" */
    private String group;
    private String updatedAt;
}
