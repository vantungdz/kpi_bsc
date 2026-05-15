package com.company.kpi.request.admin;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Request body cho endpoint POST /v1/admin/campaigns/{id}/notify.
 *
 * <ul>
 *   <li>{@code type = "all"} — gửi cho toàn bộ nhân viên active, hoặc chỉ các {@code employeeIds} nếu có.</li>
 *   <li>{@code type = "single"} — chỉ gửi cho một nhân viên ({@code employeeId} bắt buộc).</li>
 * </ul>
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
     * Danh sách ID nhân viên (chỉ dùng khi type = "all" và muốn gửi cho một nhóm đã chọn, không rỗng).
     */
    private List<String> employeeIds = new ArrayList<>();

    /**
     * ID mẫu email (UUID string) — nếu có và mẫu đang active thì dùng subject/body từ DB.
     */
    private String emailTemplateId;

    /**
     * Tin nhắn tùy chỉnh / ghi chú (có thể map vào biến như Manager_Comment hoặc nội dung bổ sung).
     */
    private String message;

    /**
     * Giai đoạn KPI: goal_setting | mid_year | end_year
     */
    private String phase;

    /**
     * Phạm vi người nhận (gửi thông báo chiến dịch): all | individual | department
     */
    private String recipientType;

    /**
     * Danh sách ID phòng ban — dùng khi recipientType = department
     */
    private List<String> departmentIds = new ArrayList<>();
}
