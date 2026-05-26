package com.company.kpi.service.gm;

import com.company.kpi.aggregate.GmTimelineIssueRow;
import com.company.kpi.common.exception.AppException;
import com.company.kpi.entity.PromotionCycle;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.PromotionCycleMapper;
import com.company.kpi.response.gm.GmPromotionProcessTimelineResponse;
import com.company.kpi.response.gm.GmTimelineDepartmentGroupDto;
import com.company.kpi.response.gm.GmTimelineIssueDetailDto;
import com.company.kpi.response.gm.GmTimelineIssueGroupDto;
import com.company.kpi.response.gm.GmTimelineKpiGroupDto;
import com.company.kpi.response.gm.GmTimelinePhaseData;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Promotion process timeline — single operational phase, {@code promotion_cycles} date window.
 */
@Service
@RequiredArgsConstructor
public class PromotionProcessTimelineService {

    public static final String SEGMENT_NOT_STARTED = "NOT_STARTED";
    public static final String SEGMENT_IN_PROGRESS = "IN_PROGRESS";
    public static final String SEGMENT_COMPLETED = "COMPLETED";
    public static final String SEGMENT_OVERDUE = "OVERDUE";

    private static final int STATUS_ACCEPTED = 405;
    private static final int STATUS_MID_WAITING_PM = 501;
    private static final int STATUS_MID_WAITING_GM = 502;
    private static final int STATUS_MID_COMPLETED = 503;
    private static final int STATUS_MID_REJECTED = 504;
    private static final int STATUS_END_REJECTED = 604;
    private static final int STATUS_CYCLE_COMPLETED = 603;

    private static final String ID_PROMO_NOT_SUBMITTED = "promo_not_submitted";
    private static final String ID_PROMO_OVERDUE_NOT_SUBMITTED = "promo_overdue_not_submitted";
    private static final String ID_PROMO_PENDING_PM = "promo_pending_pm_evaluation";
    private static final String ID_PROMO_PENDING_GM = "promo_pending_gm_evaluation";
    private static final String ID_PROMO_REJECTED = "promo_rejected";

    private static final List<String> PROMO_GROUP_ORDER = List.of(
            ID_PROMO_OVERDUE_NOT_SUBMITTED,
            ID_PROMO_NOT_SUBMITTED,
            ID_PROMO_PENDING_PM,
            ID_PROMO_PENDING_GM,
            ID_PROMO_REJECTED);

    private final PromotionCycleMapper promotionCycleMapper;
    private final KpiAssignmentMapper kpiAssignmentMapper;

    public GmPromotionProcessTimelineResponse getTimeline(UUID promotionCycleId) {
        PromotionCycle cycle = loadCycle(promotionCycleId);
        List<GmTimelineIssueRow> rows = kpiAssignmentMapper.listPromotionTimelineAssignments(promotionCycleId);
        return buildResponse(cycle, rows);
    }

    public GmPromotionProcessTimelineResponse getTimelineForPm(UUID promotionCycleId, UUID pmId) {
        PromotionCycle cycle = loadCycle(promotionCycleId);
        List<GmTimelineIssueRow> rows =
                kpiAssignmentMapper.listPromotionTimelineAssignmentsForPm(promotionCycleId, pmId);
        return buildResponse(cycle, rows);
    }

    private PromotionCycle loadCycle(UUID promotionCycleId) {
        return promotionCycleMapper.findById(promotionCycleId)
                .orElseThrow(() -> AppException.notFound("Promotion cycle not found: " + promotionCycleId));
    }

    private GmPromotionProcessTimelineResponse buildResponse(PromotionCycle cycle, List<GmTimelineIssueRow> rows) {
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime start = cycle.getStartDate();
        OffsetDateTime end = cycle.getEndDate();

        GmTimelinePhaseData operational = buildOperationalPhase(rows, start, end, now);

        GmPromotionProcessTimelineResponse response = new GmPromotionProcessTimelineResponse();
        response.setPromotionCycleId(cycle.getId());
        response.setName(cycle.getName());
        response.setStartDate(start);
        response.setEndDate(end);
        response.setDurationMonths(resolveDurationMonths(cycle));
        response.setStatusCode(cycle.getStatusCode());
        response.setProgressPercent(computeProgressPercent(start, end, now));
        response.setActiveSegment(resolveActiveSegment(rows, operational, start, end, now));
        response.setOperational(operational);
        return response;
    }

    private static Integer resolveDurationMonths(PromotionCycle cycle) {
        if (cycle.getDurationMonths() != null && cycle.getDurationMonths() > 0) {
            return cycle.getDurationMonths();
        }
        OffsetDateTime start = cycle.getStartDate();
        OffsetDateTime end = cycle.getEndDate();
        if (start == null || end == null || !end.isAfter(start)) {
            return null;
        }
        long months = ChronoUnit.MONTHS.between(start.toLocalDate(), end.toLocalDate());
        if (end.toLocalDate().isAfter(start.toLocalDate().plusMonths(months))) {
            months += 1;
        }
        return (int) Math.max(1, months);
    }

    static int computeProgressPercent(OffsetDateTime start, OffsetDateTime end, OffsetDateTime now) {
        if (start == null || end == null || !end.isAfter(start)) {
            return 0;
        }
        if (now.isBefore(start)) {
            return 0;
        }
        if (now.isAfter(end)) {
            return 100;
        }
        long totalDays = ChronoUnit.DAYS.between(start.toLocalDate(), end.toLocalDate());
        if (totalDays <= 0) {
            return 100;
        }
        long elapsed = ChronoUnit.DAYS.between(start.toLocalDate(), now.toLocalDate());
        int pct = (int) Math.round((elapsed * 100.0) / totalDays);
        return Math.min(100, Math.max(0, pct));
    }

    static String resolveActiveSegment(
            List<GmTimelineIssueRow> rows,
            GmTimelinePhaseData operational,
            OffsetDateTime start,
            OffsetDateTime end,
            OffsetDateTime now) {
        if (start != null && now.isBefore(start)) {
            return SEGMENT_NOT_STARTED;
        }
        if (allAssignmentsCompleted(rows)) {
            return SEGMENT_COMPLETED;
        }
        boolean hasOpenIssues = operational != null && operational.isHasOpenIssues();
        if (end != null && now.isAfter(end) && hasOpenIssues) {
            return SEGMENT_OVERDUE;
        }
        if (end != null && now.isAfter(end)) {
            return SEGMENT_OVERDUE;
        }
        return SEGMENT_IN_PROGRESS;
    }

    private static boolean allAssignmentsCompleted(List<GmTimelineIssueRow> rows) {
        if (rows == null || rows.isEmpty()) {
            return false;
        }
        return rows.stream().allMatch(r -> isCompletedStatus(r.getStatusCode()));
    }

    private static boolean isCompletedStatus(Integer code) {
        return code != null && (code == STATUS_MID_COMPLETED || code == STATUS_CYCLE_COMPLETED);
    }

    private GmTimelinePhaseData buildOperationalPhase(
            List<GmTimelineIssueRow> rows,
            OffsetDateTime start,
            OffsetDateTime end,
            OffsetDateTime now) {

        Map<String, MutableGroup> groups = new LinkedHashMap<>();
        boolean inWindow = isInPromotionWindow(start, end, now);
        boolean pastEnd = end != null && now.isAfter(end);

        for (GmTimelineIssueRow row : rows) {
            if (row == null) {
                continue;
            }
            int code = row.getStatusCode();
            if (isCompletedStatus(code)) {
                continue;
            }
            if (code == STATUS_ACCEPTED) {
                if (pastEnd) {
                    addAssignment(groups, ID_PROMO_OVERDUE_NOT_SUBMITTED, row, "Member",
                            "Promotion cycle ended but evidence not yet submitted");
                } else if (inWindow) {
                    addAssignment(groups, ID_PROMO_NOT_SUBMITTED, row, "Member",
                            "Within promotion window but evidence not yet submitted");
                }
                continue;
            }
            if (code == STATUS_MID_WAITING_PM) {
                addAssignment(groups, ID_PROMO_PENDING_PM, row, "PM",
                        "PM has not completed promotion evaluation");
                continue;
            }
            if (code == STATUS_MID_WAITING_GM) {
                addAssignment(groups, ID_PROMO_PENDING_GM, row, "GM",
                        "GM has not finalized promotion evaluation");
                continue;
            }
            if (code == STATUS_MID_REJECTED || code == STATUS_END_REJECTED) {
                addAssignment(groups, ID_PROMO_REJECTED, row, "Member",
                        "Promotion evaluation rejected");
            }
        }

        return finalizePhase(orderedGroups(groups, PROMO_GROUP_ORDER), "Promotion");
    }

    private static boolean isInPromotionWindow(OffsetDateTime start, OffsetDateTime end, OffsetDateTime now) {
        if (start == null || end == null) {
            return false;
        }
        return !now.isBefore(start) && !now.isAfter(end);
    }

    private static void addAssignment(
            Map<String, MutableGroup> groups,
            String groupId,
            GmTimelineIssueRow row,
            String bottleneck,
            String reason) {
        getOrCreateGroup(groups, groupId).putAssignmentDetail(buildAssignmentDetail(row, bottleneck, reason));
    }

    private static MutableGroup getOrCreateGroup(Map<String, MutableGroup> map, String groupId) {
        return map.computeIfAbsent(groupId, MutableGroup::new);
    }

    private static List<GmTimelineIssueGroupDto> orderedGroups(Map<String, MutableGroup> map, List<String> order) {
        List<GmTimelineIssueGroupDto> out = new ArrayList<>();
        for (String id : order) {
            MutableGroup g = map.get(id);
            if (g != null && !g.isEmpty()) {
                out.add(g.toDto());
            }
        }
        return out;
    }

    private static String formatIssueCountLabel(int opCount) {
        if (opCount <= 0) {
            return "0 issues";
        }
        if (opCount == 1) {
            return "1 issue";
        }
        return opCount + " issues";
    }

    private static GmTimelinePhaseData finalizePhase(List<GmTimelineIssueGroupDto> groups, String phaseLabelShort) {
        GmTimelinePhaseData phase = new GmTimelinePhaseData();
        phase.setIssueGroups(groups);
        int opCount = groups.size();
        phase.setOperationalIssueCount(opCount);
        Set<UUID> distinctSubjects = new LinkedHashSet<>();
        for (GmTimelineIssueGroupDto g : groups) {
            for (GmTimelineIssueDetailDto e : g.getEmployees()) {
                if (e.getSubjectUserId() != null) {
                    distinctSubjects.add(e.getSubjectUserId());
                }
            }
        }
        phase.setTotalDistinctEmployeesAffected(distinctSubjects.size());
        phase.setHasOpenIssues(opCount > 0);
        String issuesLabel = formatIssueCountLabel(opCount);
        phase.setPendingKpisLine(issuesLabel);
        phase.setPopoverTitle(issuesLabel + " — " + phaseLabelShort);
        return phase;
    }

    private static GmTimelineIssueDetailDto buildAssignmentDetail(
            GmTimelineIssueRow row, String bottleneck, String reason) {
        GmTimelineIssueDetailDto d = new GmTimelineIssueDetailDto();
        d.setAssignmentId(row.getAssignmentId());
        d.setParentAssignmentId(row.getParentAssignmentId());
        d.setSubjectUserId(row.getUserId());
        d.setMasterKpiId(row.getMasterKpiId());
        d.setKpi(row.getKpiName());
        d.setMember(row.getMemberName());
        d.setRoleCode(row.getRoleCode());
        d.setPm(row.getPmName() != null ? row.getPmName() : "—");
        d.setLeader(row.getLeaderName());
        d.setDepartmentName(row.getDepartmentName());
        d.setBottleneck(bottleneck);
        d.setReason(reason);
        return d;
    }

    private static List<GmTimelineKpiGroupDto> buildKpiGroups(
            List<GmTimelineIssueDetailDto> employees, String issueGroupId) {
        if (employees == null || employees.isEmpty()) {
            return List.of();
        }
        Map<String, List<GmTimelineIssueDetailDto>> byKpi = new LinkedHashMap<>();
        for (GmTimelineIssueDetailDto e : employees) {
            byKpi.computeIfAbsent(kpiBucketKey(e), k -> new ArrayList<>()).add(e);
        }
        List<GmTimelineKpiGroupDto> out = new ArrayList<>();
        for (List<GmTimelineIssueDetailDto> kpiItems : byKpi.values()) {
            out.add(buildOneKpiGroup(kpiItems, issueGroupId));
        }
        out.sort(Comparator.comparingInt(GmTimelineKpiGroupDto::getAffectedEmployees).reversed());
        return out;
    }

    private static String kpiBucketKey(GmTimelineIssueDetailDto e) {
        if (e.getMasterKpiId() != null) {
            return e.getMasterKpiId().toString();
        }
        String k = e.getKpi();
        if (k == null || k.isBlank() || "—".equals(k)) {
            return "kpi:_none_";
        }
        return "kpi:name:" + k.trim();
    }

    private static GmTimelineKpiGroupDto buildOneKpiGroup(
            List<GmTimelineIssueDetailDto> kpiItems, String issueGroupId) {
        Map<String, List<GmTimelineIssueDetailDto>> byDept = new LinkedHashMap<>();
        for (GmTimelineIssueDetailDto e : kpiItems) {
            byDept.computeIfAbsent(deptBucketKey(e), k -> new ArrayList<>()).add(e);
        }
        List<GmTimelineDepartmentGroupDto> deptDtos = new ArrayList<>();
        for (Map.Entry<String, List<GmTimelineIssueDetailDto>> en : byDept.entrySet()) {
            List<GmTimelineIssueDetailDto> slice = en.getValue();
            GmTimelineDepartmentGroupDto d = new GmTimelineDepartmentGroupDto();
            String dk = en.getKey();
            d.setDepartmentName(dk.isEmpty() ? null : dk);
            d.setAffectedEmployees(distinctAssigneeCount(slice));
            d.setEmployees(new ArrayList<>(nestCascadeInDeptSlice(slice)));
            deptDtos.add(d);
        }
        deptDtos.sort(Comparator.comparingInt(GmTimelineDepartmentGroupDto::getAffectedEmployees).reversed());

        Set<String> distinctDepts = new HashSet<>();
        for (GmTimelineIssueDetailDto e : kpiItems) {
            String dn = e.getDepartmentName();
            if (dn != null && !dn.isBlank()) {
                distinctDepts.add(dn.trim());
            }
        }

        String kpiName = kpiItems.stream()
                .map(GmTimelineIssueDetailDto::getKpi)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty() && !"—".equals(s))
                .findFirst()
                .orElse("—");
        UUID masterId = kpiItems.stream()
                .map(GmTimelineIssueDetailDto::getMasterKpiId)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);

        GmTimelineKpiGroupDto dto = new GmTimelineKpiGroupDto();
        dto.setMasterKpiId(masterId);
        dto.setKpiName(kpiName);
        dto.setAffectedEmployees(distinctAssigneeCount(kpiItems));
        dto.setAffectedDepartments(distinctDepts.size());
        dto.setBlockerSummary(blockerSummaryForIssue(issueGroupId));
        dto.setPmName(null);
        dto.setLeaderName(null);
        dto.setDepartments(deptDtos);
        return dto;
    }

    private static String deptBucketKey(GmTimelineIssueDetailDto e) {
        String d = e.getDepartmentName();
        if (d == null || d.isBlank()) {
            return "";
        }
        return d.trim();
    }

    private static String timelineIssueSubjectKey(GmTimelineIssueDetailDto e) {
        if (e.getSubjectUserId() == null) {
            UUID assignmentId = e.getAssignmentId();
            return assignmentId == null ? UUID.randomUUID().toString() : "assignment:" + assignmentId;
        }
        return "user:" + e.getSubjectUserId()
                + "|kpi:" + kpiBucketKey(e)
                + "|dept:" + deptBucketKey(e);
    }

    private static GmTimelineIssueDetailDto chooseTimelineIssueDetail(
            GmTimelineIssueDetailDto existing,
            GmTimelineIssueDetailDto candidate) {
        if (existing == null) {
            return candidate;
        }
        if (candidate == null) {
            return existing;
        }
        boolean existingRoot = existing.getParentAssignmentId() == null;
        boolean candidateRoot = candidate.getParentAssignmentId() == null;
        if (candidateRoot && !existingRoot) {
            return candidate;
        }
        if (existing.getAssignmentId() == null && candidate.getAssignmentId() != null) {
            return candidate;
        }
        return existing;
    }

    private static int distinctAssigneeCount(List<GmTimelineIssueDetailDto> items) {
        Set<String> keys = new LinkedHashSet<>();
        for (GmTimelineIssueDetailDto item : items) {
            if (item.getSubjectUserId() != null) {
                keys.add("u:" + item.getSubjectUserId());
                continue;
            }
            String member = item.getMember();
            if (member != null && !member.isBlank()) {
                keys.add("name:" + member.trim().toLowerCase(Locale.ROOT));
            }
        }
        return keys.size();
    }

    private static List<GmTimelineIssueDetailDto> nestCascadeInDeptSlice(List<GmTimelineIssueDetailDto> slice) {
        if (slice == null || slice.isEmpty()) {
            return List.of();
        }
        Map<UUID, GmTimelineIssueDetailDto> byId = new LinkedHashMap<>();
        for (GmTimelineIssueDetailDto d : slice) {
            d.setCascadeChildren(new ArrayList<>());
            if (d.getAssignmentId() != null) {
                byId.put(d.getAssignmentId(), d);
            }
        }
        List<GmTimelineIssueDetailDto> roots = new ArrayList<>();
        for (GmTimelineIssueDetailDto d : slice) {
            UUID pid = d.getParentAssignmentId();
            if (pid != null && byId.containsKey(pid)) {
                byId.get(pid).getCascadeChildren().add(d);
            } else {
                roots.add(d);
            }
        }
        return roots;
    }

    private static String blockerSummaryForIssue(String issueGroupId) {
        return switch (issueGroupId) {
            case ID_PROMO_NOT_SUBMITTED -> "Not submitted";
            case ID_PROMO_OVERDUE_NOT_SUBMITTED -> "Overdue — not submitted";
            case ID_PROMO_PENDING_PM -> "Pending PM evaluation";
            case ID_PROMO_PENDING_GM -> "Pending GM evaluation";
            case ID_PROMO_REJECTED -> "Rejected";
            default -> "Action pending";
        };
    }

    private static final class MutableGroup {
        private final String id;
        private final LinkedHashMap<String, GmTimelineIssueDetailDto> bySubjectKey = new LinkedHashMap<>();

        private MutableGroup(String id) {
            this.id = id;
        }

        void putAssignmentDetail(GmTimelineIssueDetailDto detail) {
            if (detail == null) {
                return;
            }
            bySubjectKey.merge(
                    timelineIssueSubjectKey(detail),
                    detail,
                    PromotionProcessTimelineService::chooseTimelineIssueDetail);
        }

        boolean isEmpty() {
            return bySubjectKey.isEmpty();
        }

        GmTimelineIssueGroupDto toDto() {
            GroupMeta meta = GroupMeta.forId(id);
            List<GmTimelineIssueDetailDto> employees = new ArrayList<>(bySubjectKey.values());

            long distinctKpi = employees.stream()
                    .map(GmTimelineIssueDetailDto::getKpi)
                    .filter(Objects::nonNull)
                    .filter(k -> !k.isBlank() && !"—".equals(k))
                    .distinct()
                    .count();

            long distinctDept = employees.stream()
                    .map(GmTimelineIssueDetailDto::getDepartmentName)
                    .filter(Objects::nonNull)
                    .filter(s -> !s.isBlank())
                    .distinct()
                    .count();

            GmTimelineIssueGroupDto dto = new GmTimelineIssueGroupDto();
            dto.setId(id);
            dto.setTitle(meta.title());
            dto.setSeverity(meta.severity());
            dto.setBlockedRole(meta.blockedRole());
            dto.setIconClass(meta.iconClass());
            dto.setAffectedEmployees(distinctAssigneeCount(employees));
            dto.setAffectedKpis((int) distinctKpi);
            dto.setAffectedDepartments((int) distinctDept);
            dto.setEmployees(employees);
            dto.setKpiGroups(buildKpiGroups(employees, id));
            dto.setBreakdownGroups(new ArrayList<>());
            return dto;
        }
    }

    private record GroupMeta(String title, String severity, String blockedRole, String iconClass) {
        static GroupMeta forId(String id) {
            return switch (id) {
                case ID_PROMO_OVERDUE_NOT_SUBMITTED -> new GroupMeta(
                        "Not Submitted (Overdue)",
                        "critical",
                        "Member",
                        "bg-rose-100 text-rose-600");
                case ID_PROMO_NOT_SUBMITTED -> new GroupMeta(
                        "Not Submitted",
                        "warning",
                        "Member",
                        "bg-orange-100 text-orange-600");
                case ID_PROMO_PENDING_PM -> new GroupMeta(
                        "Pending PM Evaluation",
                        "warning",
                        "PM",
                        "bg-orange-100 text-orange-600");
                case ID_PROMO_PENDING_GM -> new GroupMeta(
                        "Pending GM Evaluation",
                        "warning",
                        "GM",
                        "bg-amber-100 text-amber-700");
                case ID_PROMO_REJECTED -> new GroupMeta(
                        "Rejected",
                        "warning",
                        "Member",
                        "bg-rose-100 text-rose-600");
                default -> new GroupMeta(
                        "Operational issue",
                        "info",
                        "Member",
                        "bg-slate-100 text-slate-600");
            };
        }
    }
}
