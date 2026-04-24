package com.company.kpi.request.admin;

import lombok.Data;

/**
 * Request body cho endpoint POST /v1/admin/campaigns/{id}/notify.
 *
 * Phân biệt hai kiểu gửi:
 *  - type = "all"    → gửi cho toàn bộ nhân viên trong campaign
 *  - type = "single" → chỉ gửi cho một nhân viên cụ thể (employeeId bắt buộc)
 */
@Data
public class NotifyRequest {

    /**
     * Loại gửi: "all" hoặc "single"
     */
    private String type;

    /**
     * ID nhân viên cần nhắc (chỉ dùng khi type = "single")
     */
    private String employeeId;

    /**
     * Tin nhắn tùy chỉnh (không bắt buộc — backend có thể dùng template mặc định)
     */
    private String message;
}
