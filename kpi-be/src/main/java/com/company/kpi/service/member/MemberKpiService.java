package com.company.kpi.service.member;

import com.company.kpi.common.constant.Constant;
import com.company.kpi.entity.KpiCycle;
import com.company.kpi.entity.User;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.mapper.UserMapper;
import com.company.kpi.request.member.SaveDraftRequest;
import com.company.kpi.request.member.SelfScoreRequest;
import com.company.kpi.request.member.SubmitEvalRequest;
import com.company.kpi.response.member.MemberKpiAssignmentDTO;
import com.company.kpi.response.member.MemberKpiDashboardResponse;
import com.company.kpi.response.pm.KpiSheetResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.*;

/**
 * MemberKpiService — Member KPI dashboard, self-score, submit, save-draft.
 *
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MemberKpiService {

    private final KpiCycleMapper kpiCycleMapper;
    private final UserMapper userMapper;
    private final KpiAssignmentMapper kpiAssignmentMapper;

    public MemberKpiDashboardResponse getDashboard(Integer year, UUID userId) {

        Optional<KpiCycle> optionalKpiCycle = kpiCycleMapper.findByYear(year);
        if (optionalKpiCycle.isEmpty()) {
            return null;
        }
        KpiCycle cycle = optionalKpiCycle.get();

        Optional<User> optionalUser = userMapper.findById(userId);
        if (optionalUser.isEmpty()) {
            return null;
        }

        List<MemberKpiAssignmentDTO> assignmentDTOs = kpiAssignmentMapper.findDetailsByUserAndCycle(userId, cycle.getId());

        List<MemberKpiDashboardResponse.MemberKpiAssignmentResponse> assignments = new ArrayList<>();
        List<MemberKpiDashboardResponse.MemberKpiCategoryResponse> categories = new ArrayList<>();
        Set<UUID> categoryIds = new HashSet<>();
        for (MemberKpiAssignmentDTO assignmentDTO : assignmentDTOs) {
            // extract categories from assignments, avoid duplicates
            UUID categoryId = assignmentDTO.getCategoryId();
            if (categoryIds.add(categoryId)) {
                categories.add(new MemberKpiDashboardResponse.MemberKpiCategoryResponse(categoryId, assignmentDTO.getCategoryName()));
            }

            // map assignmentDTO to MemberKpiAssignmentResponse
            MemberKpiDashboardResponse.MemberKpiAssignmentResponse memberKpiAssignmentResponse = new MemberKpiDashboardResponse.MemberKpiAssignmentResponse();
            memberKpiAssignmentResponse.setAssignmentId(assignmentDTO.getAssignmentId());
            memberKpiAssignmentResponse.setObjective(assignmentDTO.getObjective());
            memberKpiAssignmentResponse.setTargetDescription(assignmentDTO.getTargetDescription());
            memberKpiAssignmentResponse.setWeight(assignmentDTO.getWeight());
            memberKpiAssignmentResponse.setType(assignmentDTO.getType());
            memberKpiAssignmentResponse.setMidSelfScore(assignmentDTO.getMidSelfScore());
            memberKpiAssignmentResponse.setEndSelfScore(assignmentDTO.getEndSelfScore());
            memberKpiAssignmentResponse.setEndPmScore(assignmentDTO.getEndPmScore());
            memberKpiAssignmentResponse.setEvidences(assignmentDTO.getEvidences());
            memberKpiAssignmentResponse.setCategoryId(assignmentDTO.getCategoryId());

            assignments.add(memberKpiAssignmentResponse);
        }

        String phase = this.getCurrentPhase(cycle);
        String phaseLabel = this.getPhaseLabel(phase);

        return MemberKpiDashboardResponse.builder().year(year).phase(phase).phaseLabel(phaseLabel).assignments(assignments).categories(categories).build();
    }

    public KpiSheetResponse updateSelfScore(UUID itemId, SelfScoreRequest request) {
        throw new UnsupportedOperationException("MemberKpiService.updateSelfScore() not yet implemented.");
    }

    /**
     * Update evidences in KPI Assignment table.
     *
     * @param request SubmitEvalRequest containing assignmentId and evidence string
     */
    public void submitEvaluation(SubmitEvalRequest request) {
        String evidences = request.getEvidence();
        UUID assignmentId = request.getAssignmentId();
        kpiAssignmentMapper.updateEvidence(assignmentId, evidences);
    }

    public KpiSheetResponse saveDraft(SaveDraftRequest request) {
        throw new UnsupportedOperationException("MemberKpiService.saveDraft() not yet implemented.");
    }

    private String getCurrentPhase(KpiCycle cycle) {
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime goalSettingDeadline = cycle.getGoalSettingDeadline();
        OffsetDateTime midYearDeadline = cycle.getMidYearDeadline();

        if (goalSettingDeadline != null && !now.isAfter(goalSettingDeadline)) {
            return Constant.TARGET_SETUP_PHASE;
        }

        if (midYearDeadline != null && !now.isAfter(midYearDeadline)) {
            return Constant.MID_YEAR_PHASE;
        }

        return Constant.END_YEAR_PHASE;
    }

    private String getPhaseLabel(String phase) {
        return Constant.PHASE_LABEL_MAP.getOrDefault(phase, StringUtils.EMPTY);
    }
}
