package com.company.kpi.util;

import com.company.kpi.common.Constants;

import java.util.Set;

/**
 * User (member hoặc PM) chỉ được nhận thêm KPI mới khi mọi assignment hiện có trong chu kỳ thuộc
 * {@code 404}, {@code 406} hoặc {@code 407}. Các ASM khác (vd. 405 đang chạy) coi là KPI đang hoạt động.
 */
public final class MemberAssignmentEligibility {

    public static final String BLOCK_ASSIGN_MEMBER_MESSAGE =
            "Không thể giao KPI cho thành viên vì nhân viên đang có KPI đang hoạt động.";

    public static final String BLOCK_ASSIGN_PM_MESSAGE =
            "Không thể giao KPI cho PM vì PM đang có KPI đang hoạt động. Vui lòng unlock KPI của PM trước.";

    /** @deprecated dùng {@link #BLOCK_ASSIGN_MEMBER_MESSAGE} */
    public static final String BLOCK_ASSIGN_MESSAGE = BLOCK_ASSIGN_MEMBER_MESSAGE;

    private static final Set<Integer> ALLOWED_EXISTING_STATUSES = Set.of(
            Constants.AssignStatus.PENDING_ACCEPTANCE,
            Constants.AssignStatus.REJECTED,
            Constants.AssignStatus.FEEDBACK_IN_PROGRESS);

    private MemberAssignmentEligibility() {}

    public static boolean isAllowedExistingStatus(Integer statusCode) {
        return statusCode != null && ALLOWED_EXISTING_STATUSES.contains(statusCode);
    }

    public static boolean isBlockingExistingStatus(Integer statusCode) {
        return statusCode != null && !isAllowedExistingStatus(statusCode);
    }
}
