package com.company.kpi.mapper;

import com.company.kpi.aggregate.KpiAssignmentInsertRow;
import com.company.kpi.aggregate.KpiAssignmentUserTargetRow;
import com.company.kpi.aggregate.GmTimelineIssueRow;
import com.company.kpi.aggregate.KpiAssignmentDetailAggregate;
import com.company.kpi.aggregate.PmDashboardAggregate;
import com.company.kpi.entity.KpiAssignment;
import com.company.kpi.response.gm.GmApprovedKpiQueueItemResponse;
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
            @Param("evidences") String evidences);

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

    List<KpiAssignmentUserTargetRow> listAssignmentUserTargetsByDepartment(
            @Param("kpiInfoId") UUID kpiInfoId,
            @Param("cycleId") UUID cycleId,
            UUID actorId,
            UUID departmentId);

    int softDeleteKpiAssignmentById(
            @Param("assignmentId") UUID assignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("updatedBy") UUID updatedBy);

    int updateKpiAssignmentTarget(
            @Param("assignmentId") UUID assignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("targetValue") BigDecimal targetValue,
            @Param("updatedBy") UUID updatedBy);

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

    /** Cuối năm: ghi {@code end_gm_score}, 602→603. */
    int updateGmEvaluationHubConfirmGrade602(
            @Param("assignmentId") UUID assignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("evaluationUserId") UUID evaluationUserId,
            @Param("endGmScore") BigDecimal endGmScore,
            @Param("updatedBy") UUID updatedBy);

    List<GmApprovedKpiQueueItemResponse> listGmApprovedKpiQueue(@Param("cycleId") UUID cycleId);

    /** Chỉ khi {@code status_code = 403} (chờ GM duyệt tạo mới). */
    int updateGmAssignmentStatusFromWaitingGm(
            @Param("assignmentId") UUID assignmentId,
            @Param("cycleId") UUID cycleId,
            @Param("newStatus") int newStatus,
            @Param("updatedBy") UUID updatedBy);

    /**
     * Timeline issues: tất cả {@code kpi_assignments} có status 401–603 trong chu kỳ.
     * Service tự phân loại phase + issue type. DISTINCT ON (ka.id) để tránh duplicate.
     */
    List<GmTimelineIssueRow> listTimelineAssignments(@Param("cycleId") UUID cycleId);

    /**
     * Not-submitted: ASM đang ở {@code statuses} (405 hoặc 405+503) trong review window của phase.
     * {@code phase}: "mid" = kiểm tra {@code mid_year_start/end}; "yearEnd" = {@code end_year_start/end}.
     */
    List<GmTimelineIssueRow> listInProgressWithinPhaseWindow(
            @Param("cycleId") UUID cycleId,
            @Param("statuses") List<Integer> statuses,
            @Param("phase") String phase);

    int updateKpiStatuses(
        @Param("userId") UUID userId,
        @Param("cycleId") UUID cycleId,
        @Param("statusCode") Integer statusCode,
        @Param("promotion") Boolean promotion
    );

    List<KpiAssignmentDetailAggregate> findKpiDetailsByUserAndCycle(@Param("userId") UUID userId, @Param("cycleId") UUID cycleId);
}
