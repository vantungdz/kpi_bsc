package com.company.kpi.response.admin;

import lombok.Data;

import java.time.OffsetDateTime;

@Data
public class AdminEmployeeProgressResponse {

    private String id;
    private String name;
    private String email;
    private String section;
    private String division;
    /** Giá trị: "completed" | "pending" | "overdue" | "not_started" */
    private String status;
    private String lastUpdate;
}
