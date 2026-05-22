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
    /** UUID phòng ban primary (departments.id) */
    private String sectionId;
    private String rank;
    private String jobTitle;
    private String jobTitleId;
    /** Giá trị: "active" | "inactive" */
    private String status;

    /** Vai trò hệ thống: MEMBER | LEADER | PM */
    private String roleCode;

    /** Phòng PM quản lý ({@code departments.manager_id}) — chỉ khi role PM */
    private String managedDepartmentId;

    /** Leader: user id các member đang có {@code supervisor_id} = leader trong phòng primary */
    private java.util.List<String> memberIds;
}
