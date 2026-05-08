package com.company.kpi.response.member;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Trả về sau khi member gửi / cập nhật feedback (ASM 407). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MemberFeedbackSubmitResponse {
    /** Mã role cần xử lý: {@code PM} hoặc {@code GM} (theo {@code kpi_assignment_feedbacks.target_role_id}). */
    private String feedbackTargetRoleCode;
    /** Nhãn trạng thái hiển thị cho member (407). */
    private String assignmentStatusName;
}
