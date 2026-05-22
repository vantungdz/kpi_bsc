package com.company.kpi.util;

/**
 * Quy tắc PM/GM xem Actual & Self score của member trước khi member gửi đánh giá.
 * <ul>
 *   <li>405 — PM & GM không thấy</li>
 *   <li>501 — PM thấy, GM không</li>
 *   <li>502 — PM & GM thấy</li>
 *   <li>Khác — thấy bình thường</li>
 * </ul>
 */
public final class MemberEvaluationVisibility {

    private static final int ASM_ACCEPTED = 405;
    private static final int ASM_MID_WAITING_PM = 501;
    private static final int ASM_MID_WAITING_GM = 502;

    private MemberEvaluationVisibility() {}

    public static boolean canSupervisorViewMemberSelfEvaluation(Integer statusCode, boolean viewerIsGm) {
        if (statusCode == null) {
            return true;
        }
        if (statusCode == ASM_ACCEPTED) {
            return false;
        }
        if (statusCode == ASM_MID_WAITING_PM) {
            return !viewerIsGm;
        }
        if (statusCode == ASM_MID_WAITING_GM) {
            return true;
        }
        return true;
    }
}
