package com.company.kpi.util;

import java.math.BigDecimal;

/**
 * Quy tắc hiển thị Actual &amp; Self score của member theo ASM.
 * <ul>
 *   <li>Bảng KPI Department / KPI Personal &amp; Promotion (leader/member) — giữa kỳ ≥502, cuối kỳ ≥602</li>
 *   <li>Bảng portfolio PM own — giữa kỳ ≤405, cuối kỳ thêm 503 + mốc leader/member</li>
 *   <li>Strategic KPIs / Promotion monitoring (GM) — giữa kỳ ≥503, cuối kỳ ≥603</li>
 *   <li>504 / 604 — ẩn trên bảng GM; PM vẫn hiển thị để sửa và gửi lại</li>
 *   <li>Drawer đánh giá PM/GM — API riêng, không lọc tại đây</li>
 * </ul>
 */
public final class MemberEvaluationVisibility {

    private static final int ASM_ACCEPTED = 405;
    private static final int ASM_MID_WAITING_PM = 501;
    private static final int ASM_MID_WAITING_GM = 502;
    private static final int ASM_MID_GM_COMPLETED = 503;
    private static final int ASM_MID_REJECTED = 504;
    private static final int ASM_END_WAITING_PM = 601;
    private static final int ASM_END_WAITING_GM = 602;
    private static final int ASM_COMPLETED = 603;
    private static final int ASM_END_REJECTED = 604;

    private MemberEvaluationVisibility() {}

    public static boolean isEvaluationRejected(Integer statusCode) {
        return statusCode != null
                && (statusCode == ASM_MID_REJECTED || statusCode == ASM_END_REJECTED);
    }

    /**
     * Bảng portfolio — leader &amp; member.
     * PM: giữa kỳ ≥502 (đến 504), cuối kỳ ≥602 (đến 604). GM: loại 504/604.
     */
    public static boolean canSupervisorViewMemberSelfEvaluation(Integer statusCode, boolean viewerIsGm) {
        if (statusCode == null) {
            return false;
        }
        if (isEvaluationRejected(statusCode) && viewerIsGm) {
            return false;
        }
        if (statusCode >= ASM_MID_WAITING_GM && statusCode <= ASM_MID_REJECTED) {
            return true;
        }
        // 601: member đã nộp cuối kỳ, chờ PM — PM cần xem self/actual (bảng dùng snapshot giữa kỳ).
        if (statusCode == ASM_END_WAITING_PM && !viewerIsGm) {
            return true;
        }
        return statusCode >= ASM_END_WAITING_GM && statusCode <= ASM_END_REJECTED;
    }

    /**
     * KPI do chính PM nhập — giữa kỳ ≤405; cuối kỳ thêm 503; cộng mốc leader/member.
     */
    public static boolean canPmOwnViewPortfolioEvaluation(Integer statusCode) {
        if (statusCode == null) {
            return false;
        }
        if (canSupervisorViewMemberSelfEvaluation(statusCode, false)) {
            return true;
        }
        if (statusCode <= ASM_ACCEPTED) {
            return true;
        }
        return statusCode == ASM_MID_GM_COMPLETED || statusCode == ASM_END_WAITING_PM;
    }

    /** Self score — bảng portfolio (leader/member). */
    public static BigDecimal resolveMemberSelfScoreForPortfolio(
            Integer statusCode, BigDecimal midSelfScore, BigDecimal endSelfScore) {
        if (statusCode == null) {
            return null;
        }
        if (statusCode >= ASM_END_WAITING_GM && statusCode <= ASM_END_REJECTED) {
            return endSelfScore != null ? endSelfScore : midSelfScore;
        }
        if (statusCode >= ASM_MID_WAITING_GM && statusCode <= ASM_MID_REJECTED) {
            return midSelfScore != null ? midSelfScore : endSelfScore;
        }
        return null;
    }

    /** Self score — Strategic KPIs / Promotion monitoring (GM). */
    public static BigDecimal resolveMemberSelfScoreForDiagnostics(
            Integer statusCode, BigDecimal midSelfScore, BigDecimal endSelfScore) {
        if (statusCode == null || isEvaluationRejected(statusCode)) {
            return null;
        }
        if (statusCode >= ASM_COMPLETED && statusCode < ASM_END_REJECTED) {
            return endSelfScore != null ? endSelfScore : midSelfScore;
        }
        if (statusCode >= ASM_MID_GM_COMPLETED && statusCode < ASM_MID_REJECTED) {
            return midSelfScore != null ? midSelfScore : endSelfScore;
        }
        return null;
    }

  /** @deprecated Dùng {@link #resolveMemberSelfScoreForPortfolio}. */
    public static BigDecimal resolveMemberSelfScoreByAsm(
            Integer statusCode, BigDecimal midSelfScore, BigDecimal endSelfScore) {
        return resolveMemberSelfScoreForPortfolio(statusCode, midSelfScore, endSelfScore);
    }

    /** Self score trên bảng portfolio sau khi áp visibility. */
    public static BigDecimal resolvePortfolioMemberSelfScore(
            Integer statusCode, BigDecimal midSelfScore, BigDecimal endSelfScore, boolean viewerIsGm) {
        if (!canSupervisorViewMemberSelfEvaluation(statusCode, viewerIsGm)) {
            return null;
        }
        return resolveMemberSelfScoreForPortfolio(statusCode, midSelfScore, endSelfScore);
    }

    public static BigDecimal resolvePmOwnPortfolioSelfScore(
            Integer statusCode, BigDecimal midSelfScore, BigDecimal endSelfScore) {
        if (!canPmOwnViewPortfolioEvaluation(statusCode)) {
            return null;
        }
        BigDecimal fromPortfolio =
                resolveMemberSelfScoreForPortfolio(statusCode, midSelfScore, endSelfScore);
        if (fromPortfolio != null) {
            return fromPortfolio;
        }
        if (statusCode != null && statusCode == ASM_MID_GM_COMPLETED) {
            BigDecimal fromDiagnostics =
                    resolveMemberSelfScoreForDiagnostics(statusCode, midSelfScore, endSelfScore);
            if (fromDiagnostics != null) {
                return fromDiagnostics;
            }
            return endSelfScore != null ? endSelfScore : midSelfScore;
        }
        if (statusCode != null && statusCode <= ASM_ACCEPTED) {
            return midSelfScore != null ? midSelfScore : endSelfScore;
        }
        return endSelfScore != null ? endSelfScore : midSelfScore;
    }

    /**
     * Drawer đánh giá PM/GM — luôn hiển thị điểm member đã nhập khi không bị reject đánh giá.
     */
    public static BigDecimal resolveDrawerMemberSelfScore(
            Integer statusCode, BigDecimal midSelfScore, BigDecimal endSelfScore) {
        BigDecimal fromPortfolio =
                resolveMemberSelfScoreForPortfolio(statusCode, midSelfScore, endSelfScore);
        if (fromPortfolio != null) {
            return fromPortfolio;
        }
        BigDecimal fromDiagnostics =
                resolveMemberSelfScoreForDiagnostics(statusCode, midSelfScore, endSelfScore);
        if (fromDiagnostics != null) {
            return fromDiagnostics;
        }
        if (midSelfScore != null) {
            return midSelfScore;
        }
        return endSelfScore;
    }

    /**
     * Strategic KPIs / Promotion monitoring — hiển thị khi GM đã có kết quả chốt giữa kỳ hoặc đang/chốt cuối kỳ.
     * 503/601/602: snapshot; 603: cuối kỳ. 501/502/504/604 ẩn.
     */
    public static boolean canDiagnosticsShowMemberActual(Integer statusCode) {
        if (statusCode == null || isEvaluationRejected(statusCode)) {
            return false;
        }
        return statusCode == ASM_MID_GM_COMPLETED
                || statusCode == ASM_END_WAITING_PM
                || statusCode == ASM_END_WAITING_GM
                || statusCode == ASM_COMPLETED;
    }

    /**
     * Bảng PM — self score: 503/601 từ snapshot; 602/603 từ cuối kỳ (end → mid).
     */
    public static BigDecimal resolvePmTableSelfScore(
            Integer statusCode,
            BigDecimal midSelfScore,
            BigDecimal endSelfScore,
            String evidencesJson) {
        if (statusCode == null) {
            return null;
        }
        if (statusCode == ASM_MID_GM_COMPLETED || statusCode == ASM_END_WAITING_PM) {
            return snapshotSelfScoreOrFallback(evidencesJson, midSelfScore);
        }
        if (statusCode == ASM_END_WAITING_GM || statusCode == ASM_COMPLETED) {
            return endSelfScore != null ? endSelfScore : midSelfScore;
        }
        return resolveMemberSelfScoreForPortfolio(statusCode, midSelfScore, endSelfScore);
    }

    /**
     * Bảng GM — self score: 503/601/602 từ snapshot; 603 từ cuối kỳ.
     */
    public static BigDecimal resolveGmTableSelfScore(
            Integer statusCode,
            BigDecimal midSelfScore,
            BigDecimal endSelfScore,
            String evidencesJson) {
        if (statusCode == null) {
            return null;
        }
        if (statusCode == ASM_MID_GM_COMPLETED
                || statusCode == ASM_END_WAITING_PM
                || statusCode == ASM_END_WAITING_GM) {
            return snapshotSelfScoreOrFallback(evidencesJson, midSelfScore);
        }
        if (statusCode == ASM_COMPLETED) {
            return endSelfScore != null ? endSelfScore : midSelfScore;
        }
        return resolveMemberSelfScoreForDiagnostics(statusCode, midSelfScore, endSelfScore);
    }

    /** Bảng PM — actual: 503/601 từ snapshot; 602/603 từ evidences hiện tại. */
    public static String resolvePmTableActual(Integer statusCode, String evidencesJson) {
        if (statusCode == null) {
            return null;
        }
        if (statusCode == ASM_MID_GM_COMPLETED || statusCode == ASM_END_WAITING_PM) {
            return snapshotActualOrFallback(evidencesJson);
        }
        if (statusCode == ASM_END_WAITING_GM || statusCode == ASM_COMPLETED) {
            return ApprovedMidYearSnapshotSupport.extractActualFromEvidences(evidencesJson);
        }
        return null;
    }

    /** Bảng GM — actual: 503/601/602 từ snapshot; 603 từ evidences hiện tại. */
    public static String resolveGmTableActual(Integer statusCode, String evidencesJson) {
        if (statusCode == null) {
            return null;
        }
        if (statusCode == ASM_MID_GM_COMPLETED
                || statusCode == ASM_END_WAITING_PM
                || statusCode == ASM_END_WAITING_GM) {
            return snapshotActualOrFallback(evidencesJson);
        }
        if (statusCode == ASM_COMPLETED) {
            return ApprovedMidYearSnapshotSupport.extractActualFromEvidences(evidencesJson);
        }
        return null;
    }

    private static BigDecimal snapshotSelfScoreOrFallback(String evidencesJson, BigDecimal midSelfScore) {
        if (ApprovedMidYearSnapshotSupport.hasSnapshot(evidencesJson)) {
            ApprovedMidYearSnapshotSupport.Snapshot snap =
                    ApprovedMidYearSnapshotSupport.parseSnapshot(evidencesJson);
            if (snap != null && snap.selfScore() != null) {
                return snap.selfScore();
            }
            return null;
        }
        return midSelfScore;
    }

    private static String snapshotActualOrFallback(String evidencesJson) {
        if (ApprovedMidYearSnapshotSupport.hasSnapshot(evidencesJson)) {
            ApprovedMidYearSnapshotSupport.Snapshot snap =
                    ApprovedMidYearSnapshotSupport.parseSnapshot(evidencesJson);
            if (snap != null && snap.actual() != null) {
                return snap.actual();
            }
            return null;
        }
        return ApprovedMidYearSnapshotSupport.extractActualFromEvidences(evidencesJson);
    }
}
