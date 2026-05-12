package com.company.kpi.request.kpi;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class UpdateKpiStatusRequest {
    
    @NotNull
    private UUID cycleId;

    @NotNull
    private Integer statusCode;

    private boolean promotion;

    /**
     * Khi {@code true}: cập nhật KPI của mọi nhân sự trong cây báo cáo dưới PM (recursive supervisor),
     * đồng bộ {@link com.company.kpi.mapper.UserMapper#findTeamHierarchyBySupervisor}, không phải chỉ các dòng {@code user_id = PM}.
     * Dùng cho “Gửi toàn bộ đánh giá” tab Team Review (501→502 / 601→602).
     */
    private Boolean bulkForManagedMembers;

    /**
     * Khi gửi (vd. Accept KPI): chỉ cập nhật các dòng đang có {@code status_code} = giá trị này
     * (ví dụ 404 → 405). Không gửi = giữ hành vi cũ (mọi assignment khớp loại KPI).
     */
    private Integer onlyFromStatusCode;

    /**
     * Khi {@link #bulkForManagedMembers} = true: chỉ cập nhật assignment của member này
     * (gửi đánh giá từng nhân viên / từng tab). Null = toàn team như trước.
     */
    private UUID managedMemberUserId;
}