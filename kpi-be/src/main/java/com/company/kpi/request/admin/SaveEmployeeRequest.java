package com.company.kpi.request.admin;

import lombok.Data;

/**
 * Request DTO tạo / cập nhật nhân viên từ Admin module.
 * Frontend gửi tên thân thiện (name, code, sectionId, rankCode) thay vì UUID trực tiếp.
 */
@Data
public class SaveEmployeeRequest {

    /** Họ và tên đầy đủ */
    private String name;

    /** Email công ty */
    private String email;

    /** Mã nhân viên — cũng là username đăng nhập */
    private String code;

    /** UUID của phòng ban (lấy từ dropdown /admin/sections) */
    private String sectionId;

    /** Mã cấp bậc (R0, R1, R2… — lấy từ dropdown /admin/ranks) */
    private String rankCode;

    /** Mật khẩu plain text (chỉ dùng khi tạo mới, backend sẽ BCrypt hash) */
    private String password;

    /** Trạng thái: "active" | "inactive" */
    private String status;
}
