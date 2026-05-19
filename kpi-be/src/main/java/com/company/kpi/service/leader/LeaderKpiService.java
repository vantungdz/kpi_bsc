package com.company.kpi.service.leader;

import static com.company.kpi.common.constant.Constant.KpiType;

import com.company.kpi.entity.KpiCycle;
import com.company.kpi.entity.User;
import com.company.kpi.entity.UserKpiSummary;
import com.company.kpi.mapper.*;
import com.company.kpi.request.leader.LeaderScoreRequest;
import com.company.kpi.response.leader.*;

import static com.company.kpi.response.leader.LeaderKpiInformationResponse.LeaderKpiCategoryGroup;
import static com.company.kpi.response.leader.LeaderKpiInformationResponse.LeaderKpiSummary;
import static com.company.kpi.response.leader.LeaderKpiInformationResponse.LeaderKpiCycleInfo;
import static com.company.kpi.response.leader.LeaderKpiInformationResponse.LeaderKpiAssignmentResponse;
import static com.company.kpi.response.leader.LeaderMemberListResponse.MemberInfo;

import com.company.kpi.response.pm.KpiSheetResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class LeaderKpiService {

    private final KpiAssignmentMapper kpiAssignmentMapper;
    private final KpiCycleMapper kpiCycleMapper;
    private final UserDepartmentMapper userDepartmentMapper;
    private final UserMapper userMapper;
    private final UserKpiSummaryMapper userKpiSummaryMapper;

    private final ModelMapper modelMapper;

    public LeaderKpiInformationResponse getKpiInfo(Integer year, KpiType type, UUID userId) {

        Optional<KpiCycle> optionalKpiCycle = kpiCycleMapper.findByYear(year);
        if (optionalKpiCycle.isEmpty()) {
            return null;
        }
        KpiCycle cycle = optionalKpiCycle.get();

        Optional<User> optionalUser = userMapper.findById(userId);
        if (optionalUser.isEmpty()) {
            return null;
        }
        User viewer = optionalUser.get();
        OffsetDateTime accountCreatedAt = viewer.getCreatedAt();

        List<LeaderKpiAssignmentDTO> assignmentDTOs = kpiAssignmentMapper.findDetailsByUserAndCycleAndRoleLeader(userId, cycle.getId(), type.name());
        Map<UUID, LeaderKpiCategoryGroup> categoryMap = new LinkedHashMap<>();
        for (LeaderKpiAssignmentDTO dto : assignmentDTOs) {

            UUID categoryId = dto.getCategoryId();

            categoryMap.computeIfAbsent(categoryId, id ->
                    new LeaderKpiCategoryGroup(
                            id,
                            dto.getCategoryName(),
                            new ArrayList<>()
                    )
            );

            LeaderKpiAssignmentResponse assignment = modelMapper.map(dto, LeaderKpiAssignmentResponse.class);
            categoryMap.get(categoryId).getAssignments().add(assignment);
        }

        LeaderKpiSummary kpiSummary = null;
        if (!assignmentDTOs.isEmpty()) {
            Optional<UserKpiSummary> optionalUserKpiSummary = userKpiSummaryMapper.findByUserIdAndCycleId(userId, cycle.getId());
            kpiSummary = new LeaderKpiSummary();
            UserKpiSummary userKpiSummary = optionalUserKpiSummary.orElse(new UserKpiSummary());
            boolean promotionView = KpiType.PROMOTION.equals(type);

            kpiSummary.setFinalScore(Optional.ofNullable(userKpiSummary.getFinalScore()).orElse(BigDecimal.ZERO));
            kpiSummary.setEvaluationComments(
                    Optional.ofNullable(promotionView
                                    ? userKpiSummary.getEvaluationCommentsPromotion()
                                    : userKpiSummary.getEvaluationComments())
                            .orElse(StringUtils.EMPTY));
            kpiSummary.setEvaluationSupervisorComments(
                    Optional.ofNullable(promotionView
                                    ? userKpiSummary.getEvaluationSupervisorCommentsPromotion()
                                    : userKpiSummary.getEvaluationSupervisorComments())
                            .orElse(StringUtils.EMPTY));
        }

        LeaderKpiCycleInfo leaderKpiCycleInfo = modelMapper.map(cycle, LeaderKpiCycleInfo.class);

        return LeaderKpiInformationResponse.builder()
                .year(year)
                .accountCreatedAt(accountCreatedAt != null ? accountCreatedAt.toString() : null)
                .kpiCycle(leaderKpiCycleInfo)
                .categories(new ArrayList<>(categoryMap.values()))
                .kpiSummary(kpiSummary)
                .build();
    }

    public LeaderMemberListResponse getMemberList(UUID leaderId, Integer year) {
        List<LeaderMemberInfoDTO> memberInfoDTOs;

        Optional<KpiCycle> optionalCycle = kpiCycleMapper.findByYear(year);
        if (optionalCycle.isPresent()) {
            // Ưu tiên dữ liệu lịch sử snapshot: chính xác theo từng chu kỳ năm
            memberInfoDTOs = userDepartmentMapper.findLeaderMemberListByYear(leaderId, optionalCycle.get().getId());
        } else {
            memberInfoDTOs = List.of();
        }

        // Fallback: nếu chưa có snapshot nào (chu kỳ mới, chưa assign KPI) dùng cơ cấu tổ chức hiện tại
        if (memberInfoDTOs.isEmpty()) {
            memberInfoDTOs = userDepartmentMapper.findLeaderMemberListInfo(leaderId);
        }

        List<MemberInfo> memberInfoList = memberInfoDTOs.stream()
                .map(dto -> modelMapper.map(dto, MemberInfo.class))
                .toList();

        return LeaderMemberListResponse.builder()
                .members(memberInfoList)
                .build();
    }

    public LeaderKpiDashboardResponse getDashboard(Integer year) {
        throw new UnsupportedOperationException("LeaderKpiService.getDashboard() not yet implemented.");
    }

    public KpiSheetResponse scoreItem(UUID memberId, UUID itemId, LeaderScoreRequest request) {
        throw new UnsupportedOperationException("LeaderKpiService.scoreItem() not yet implemented.");
    }
}
