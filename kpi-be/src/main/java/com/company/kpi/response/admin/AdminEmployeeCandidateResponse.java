package com.company.kpi.response.admin;

import lombok.Data;

/** Ứng viên gán vào team Leader (member trong cùng phòng ban). */
@Data
public class AdminEmployeeCandidateResponse {
    private String id;
    private String name;
    private String email;
    private String rankCode;
}
