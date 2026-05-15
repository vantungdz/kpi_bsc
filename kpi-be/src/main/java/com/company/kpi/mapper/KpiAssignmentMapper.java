package com.company.kpi.mapper;

import com.company.kpi.aggregate.KpiAssignmentInsertRow;
import com.company.kpi.aggregate.KpiAssignmentUserTargetRow;
import com.company.kpi.aggregate.GmTimelineIssueRow;
import com.company.kpi.aggregate.GmUnassignedMemberRow;
import com.company.kpi.aggregate.KpiAssignmentDetailAggregate;
import com.company.kpi.aggregate.PmDashboardAggregate;
import com.company.kpi.entity.KpiAssignment;
import com.company.kpi.response.gm.GmApprovedKpiQueueItemResponse;
import com.company.kpi.response.pm.PmMemberKpiApprovalItemResponse;
import com.company.kpi.response.leader.LeaderKpiAssignmentDTO;
import com.company.kpi.response.member.MemberKpiAssignmentDTO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Mapper
public interface KpiAssignmentMapper {

    List<MemberKpiAssignmentDTO> findDetailsByUserAndCycle(
            @Param("userId") UUID userId,
            @Param("cycleId") UUID cycleId);

    int updateEvidence(
            @Param("id") UUID id,
            @Param("evidences") String evidences);

    UUID findCycleIdByAssignmentId(
            @Param("assignmentId") UUID assignmentId);

    MemberKpiAssignmentDTO findByIdAndUser(
            @Param("assignmentId") UUID assignmentId,
            @Param("userId") UUID userId);

    int patchMemberAssignment(
            @Param("id") UUID id,
            @Param("cycleId") UUID cycleId,
            @Param("userId") UUID userId,
            @Param("midSelfScore") Double mid,
            @Param("endSelfScore") Double end,
            @Param("evidences") String evidences,
            @Param("statusCode") Integer statusCode);

    int softDeleteSelfCreatedAssignment(
            @Param("assignmentId") UUID assignmentId,
            @Param("userId") UUID userId);

    int submitAssignmentFeedback(
            @Param("id") UUID id,
            @Param("cycleId") UUID cycleId,
            @Param("userId") UUID userId,
            @Param("feedbackComment") String feedbackComment,
            @Param("statusCode") Integer statusCode);

    int submitAssignmentsForMidYear(
            @Param("userId") UUID userId,
            @Param("cycleId") UUID cycleId);

    int bulkAcceptPendingForSubmit(
            @Param("userId") UUID userId,
            @Param("cycleId") UUID cycleId);

    int submitAssignmentsForYearEnd(
            @Param("userId") UUID userId,
            @Param("cycleId") UUID cycleId);

    int insert(KpiAssignment assignment);

    List<PmDashboardAggregate> findPmPortfolioByPmIdAndCycleId(
            @Param("pmId") UUID pmId,
            @Param("cycleId") UUID cycleId);

    List<LeaderKpiAssignmentDTO> findDetailsByUserAndCycleAndRoleLeader(
            @Param("userId") UUID userId,
            @Param("cycleId") UUID cycleId,
            @Param("type") String type);

    int countCompletedByCycleId(@Param("cycleId") UUID cycleId);

    int countPendingByCycleId(@Param("cycleId") UUID cycleId);

    int countOverdueByCycleId(@Param("cycleId") UUID cycleId);

    void insertKpiAssignments(@Param("rows") List<KpiAssignmentInsertRow> rows);

    int softDeleteAssignmentsForKpiInformation(
            @Param("kpiInfoId") UUID kpiInfoId,
            @Param("cycleId") UUID cycleId,
            @Param("updatedBy") UUID updatedBy);

    List<KpiAssignmentUserTargetRow> listAssignmentUserTargets(
            @Param("kpiInfoId") UUID kpiInfoId,
            @Param("cycleId") UUID cycleId);

    /** PM cascade: chỉ các assignment có parent = assignment của PM. */
    List<KpiAssignmentUserTargetRow> listChildAssignmentsByParentId(
            @Param("parentAssignmentId") UUID parentAssignmentId);

    /** Xác nhận assignment thuộc PM và đúng KPI information (khi lọc cascade). */
    int countAssignmentOwnedByUserForKpiInfo(
            @Param("assignmentId") UUID assignmentId,
            @Param("userId") UUID userId,
            @Param("kpiInfoId") UUID kpiInfoId);

    /** Parent assignment hiện tại (owner + target) trong đúng chu kỳ. */
    KpiAssignmentUserTargetRow findAssignmentUserTargetByIdAndCycle(
            @Param("assignmentId") UUID assignmentId,
            @Param("cycleId") UUID cycleId);

    int countChildAssignmentsSubmittedActualForPmReview(
            @Param("parentAssignmentId") UUID parentAssignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("pmId") UUID pmId);

    List<KpiAssignmentUserTargetRow> listAssignmentUserTargetsByDepartment(
            @Param("kpiInfoId") UUID kpiInfoId,
            @Param("cycleId") UUID cycleId,
            UUID actorId,
            UUID departmentId);

    int softDeleteKpiAssignmentById(
            @Param("assignmentId") UUID assignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("updatedBy") UUID updatedBy);

    /**
     * PM chỉnh sửa phân bổ: gỡ toàn bộ assignment con dưới parent trước khi insert danh sách mới
     * (tránh trùng bản ghi / member đã bỏ chọn vẫn còn).
     */
    int softDeleteChildAssignmentsByParentAndCycle(
            @Param("parentAssignmentId") UUID parentAssignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("updatedBy") UUID updatedBy);

    int updateKpiAssignmentTarget(
            @Param("assignmentId") UUID assignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("targetValue") BigDecimal targetValue,
            @Param("updatedBy") UUID updatedBy);

    int resubmitRejectedSelfCreatedAssignments(
            @Param("kpiInfoId") UUID kpiInfoId,
            @Param("cycleId") UUID cycleId,
            @Param("actorId") UUID actorId,
            @Param("rejectedStatus") int rejectedStatus,
            @Param("waitingGmStatus") int waitingGmStatus);

    void insertKpiAssignmentsWithEntity(@Param("rows") List<KpiAssignment> rows);
    /** Trạng thái ASM hiện tại của assignment (chu kỳ + assignee) — null nếu không tìm thấy. */
    Integer selectHubConfirmStatus(
            @Param("assignmentId") UUID assignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("evaluationUserId") UUID evaluationUserId);

    /** Giữa năm: 502→503, không ghi {@code end_gm_score}. */
    int updateGmEvaluationHubConfirmReview502(
            @Param("assignmentId") UUID assignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("evaluationUserId") UUID evaluationUserId,
            @Param("updatedBy") UUID updatedBy);

    int cascadeGmEvaluationHubTeamSliceReview502(
            @Param("sourceAssignmentId") UUID sourceAssignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("updatedBy") UUID updatedBy);

    /** Cuối năm: ghi {@code end_gm_score}, 602→603. */
    int updateGmEvaluationHubConfirmGrade602(
            @Param("assignmentId") UUID assignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("evaluationUserId") UUID evaluationUserId,
            @Param("endGmScore") BigDecimal endGmScore,
            @Param("updatedBy") UUID updatedBy);

    int cascadeGmEvaluationHubTeamSliceGrade602(
            @Param("sourceAssignmentId") UUID sourceAssignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("endGmScore") BigDecimal endGmScore,
            @Param("updatedBy") UUID updatedBy);

    /** Cập nhật comment theo từng KPI của GM vào {@code evidences.gmComment}. */
    int updateGmEvaluationHubLineComment(
            @Param("assignmentId") UUID assignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("evaluationUserId") UUID evaluationUserId,
            @Param("gmComment") String gmComment,
            @Param("updatedBy") UUID updatedBy);

    int unlockGmEvaluationHubAcceptedAssignments(
            @Param("cycleId") UUID cycleId,
            @Param("evaluationUserId") UUID evaluationUserId,
            @Param("promotion") boolean promotion,
            @Param("updatedBy") UUID updatedBy);

    List<GmApprovedKpiQueueItemResponse> listGmApprovedKpiQueue(@Param("cycleId") UUID cycleId);

    Integer findAssignmentStatusCode(
            @Param("assignmentId") UUID assignmentId, @Param("cycleId") UUID cycleId);

    /** Chỉ khi {@code status_code = 403} (chờ GM duyệt tạo mới). */
    int updateGmAssignmentStatusFromWaitingGm(
            @Param("assignmentId") UUID assignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("newStatus") int newStatus,
            @Param("updatedBy") UUID updatedBy,
            @Param("updateReason") String updateReason);

    int cascadeActivateChildAssignments(
            @Param("parentAssignmentId") UUID parentAssignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("newStatus") int newStatus,
            @Param("updatedBy") UUID updatedBy);

    int activateSelfAssignedPmChildAssignments(
            @Param("parentAssignmentId") UUID parentAssignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("updatedBy") UUID updatedBy);

    /** PM gửi feedback lên GM: assignment do PM sở hữu, 404→407. */
    int updatePmAssignmentStatusToFeedbackInProgress(
            @Param("assignmentId") UUID assignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("pmId") UUID pmId,
            @Param("updatedBy") UUID updatedBy);

    int insertAssignmentFeedbackForGm(
            @Param("assignmentId") UUID assignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("feedbackNote") String feedbackNote,
            @Param("createdBy") UUID createdBy);

    /** Resolve feedback đang active cho GM trên assignment/cycle. */
    int resolveActiveGmFeedback(
            @Param("assignmentId") UUID assignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("resolvedBy") UUID resolvedBy);

    /** 407→404 sau khi GM xử lý feedback PM. */
    int updateAssignmentStatusFromFeedbackToPendingAcceptance(
            @Param("assignmentId") UUID assignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("updatedBy") UUID updatedBy);

    /**
     * Timeline issues: tất cả {@code kpi_assignments} có status 401–603 trong chu kỳ.
     * Service tự phân loại phase + issue type. DISTINCT ON (ka.id) để tránh duplicate.
     */
    List<GmTimelineIssueRow> listTimelineAssignments(@Param("cycleId") UUID cycleId);

    /** Giống {@link #listTimelineAssignments} nhưng chỉ assignments thuộc phòng có {@code departments.manager_id = pmId}. */
    List<GmTimelineIssueRow> listTimelineAssignmentsForPm(
            @Param("cycleId") UUID cycleId, @Param("pmId") UUID pmId);

    /**
     * Not-submitted: ASM đang ở {@code statuses} (405 hoặc 405+503) trong review window của phase.
     * {@code phase}: "mid" = kiểm tra {@code mid_year_start/end}; "yearEnd" = {@code end_year_start/end}.
     */
    List<GmTimelineIssueRow> listInProgressWithinPhaseWindow(
            @Param("cycleId") UUID cycleId,
            @Param("statuses") List<Integer> statuses,
            @Param("phase") String phase);

    /** Giống {@link #listInProgressWithinPhaseWindow} nhưng chỉ phòng có {@code assign_dept.manager_id = pmId}. */
    List<GmTimelineIssueRow> listInProgressWithinPhaseWindowForPm(
            @Param("cycleId") UUID cycleId,
            @Param("statuses") List<Integer> statuses,
            @Param("phase") String phase,
            @Param("pmId") UUID pmId);

    /**
     * MEMBER-role users (primary dept) không có bản ghi {@code kpi_assignments} cá nhân trong chu kỳ.
     */
    List<GmUnassignedMemberRow> listMembersWithoutKpiAssignment(@Param("cycleId") UUID cycleId);

    /** Giống {@link #listMembersWithoutKpiAssignment} nhưng chỉ primary department có {@code d.manager_id = pmId}. */
    List<GmUnassignedMemberRow> listMembersWithoutKpiAssignmentForPm(
            @Param("cycleId") UUID cycleId, @Param("pmId") UUID pmId);

    int updateKpiStatuses(
        @Param("userId") UUID userId,
        @Param("cycleId") UUID cycleId,
        @Param("statusCode") Integer statusCode,
        @Param("promotion") Boolean promotion,
        @Param("onlyFromStatusCode") Integer onlyFromStatusCode,
        @Param("includeManagedDepartmentAssignments") Boolean includeManagedDepartmentAssignments
    );

    /**
     * PM Accept KPI (404→405): chặn nếu còn KPI Team (cascade) chưa có con hoặc còn assignment con chưa đạt 405.
     */
    boolean existsTeamCascadeBlockingPmAccept(@Param("pmId") UUID pmId, @Param("cycleId") UUID cycleId);

    /**
     * PM Personal Send Review: all member Team child assignments must already be sent to GM
     * for the corresponding phase before PM submits PM-owned KPIs.
     */
    int countBlockingPmTeamMemberReviewsForSendReview(
            @Param("pmId") UUID pmId,
            @Param("cycleId") UUID cycleId,
            @Param("waitingGmStatus") Integer waitingGmStatus,
            @Param("completedStatus") Integer completedStatus);

    /**
     * Giống {@link #updateKpiStatuses} nhưng áp dụng cho mọi assignment của user thuộc cây dưới PM (recursive {@code user_departments.supervisor_id}).
     */
    int updateKpiStatusesForPmManagedMembers(
            @Param("pmId") UUID pmId,
            @Param("cycleId") UUID cycleId,
            @Param("statusCode") Integer statusCode,
            @Param("promotion") boolean promotion,
            @Param("onlyFromStatusCode") Integer onlyFromStatusCode);

    /**
     * Giống {@link #updateKpiStatusesForPmManagedMembers} nhưng chỉ {@code memberUserId} (một nhân viên).
     */
    int updateKpiStatusesForPmManagedMemberSingle(
            @Param("pmId") UUID pmId,
            @Param("cycleId") UUID cycleId,
            @Param("memberUserId") UUID memberUserId,
            @Param("statusCode") Integer statusCode,
            @Param("promotion") boolean promotion,
            @Param("onlyFromStatusCode") Integer onlyFromStatusCode);

    /**
     * Đồng bộ KPI Team assignment cha của PM theo trạng thái mới của assignment con trong cây team.
     * Dùng cho luồng Team Review bulk submit (đưa parent vào 502/602 để GM Evaluation Hub hiển thị).
     */
    int syncPmTeamParentStatusesFromManagedChildren(
            @Param("pmId") UUID pmId,
            @Param("cycleId") UUID cycleId,
            @Param("statusCode") Integer statusCode,
            @Param("updatedBy") UUID updatedBy);

    List<KpiAssignmentDetailAggregate> findKpiDetailsByUserAndCycle(@Param("userId") UUID userId, @Param("cycleId") UUID cycleId);

    /**
     * KPI cá nhân do member tạo, ASM 402, assignee thuộc cây báo cáo dưới PM
     * (supervisor trực tiếp hoặc gián tiếp qua Leader, đồng bộ {@code findTeamHierarchyBySupervisor}).
     */
    List<PmMemberKpiApprovalItemResponse> listPmPendingMemberKpiApprovals(
            @Param("pmId") UUID pmId,
            @Param("cycleId") UUID cycleId);

    /**
     * PM duyệt (403) hoặc từ chối (406) — chỉ khi đang 402 và assignee thuộc cây dưới PM.
     */
    int updateMemberKpiApprovalStatusByPm(
            @Param("assignmentId") UUID assignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("pmId") UUID pmId,
            @Param("newStatus") int newStatus,
            @Param("updatedBy") UUID updatedBy,
            @Param("updateReason") String updateReason);

    /** PM xử lý feedback member: 407→404 cho assignment thuộc cây báo cáo dưới PM. */
    int updateMemberFeedbackStatusByPm(
            @Param("assignmentId") UUID assignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("pmId") UUID pmId,
            @Param("updatedBy") UUID updatedBy);

    /**
     * PM lưu comment theo từng KPI vào {@code kpi_assignments.evidences.gmComment}.
     * Chỉ cho phép assignment của member thuộc cây báo cáo dưới PM trong cùng chu kỳ.
     */
    int updatePmComment(
            @Param("assignmentId") UUID assignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("pmId") UUID pmId,
            @Param("gmComment") String gmComment);

    /**
     * PM lưu {@code end_pm_score} cho assignment của member ở giai đoạn cuối kỳ (ASM {@code 601} chờ PM) —
     * cùng tập member được phép {@link #updatePmComment}. Giữa kỳ ({@code 501}) không chấm điểm PM.
     * Tham số điểm đặt tên {@code pmScoreValue} để tránh interceptor mã hóa nhầm (map key {@code endPmScore}).
     */
    int updateEndPmScoreForPmManagedMember(
            @Param("assignmentId") UUID assignmentId,
            @Param("memberUserId") UUID memberUserId,
            @Param("pmId") UUID pmId,
            @Param("pmScoreValue") java.math.BigDecimal pmScoreValue);
}
