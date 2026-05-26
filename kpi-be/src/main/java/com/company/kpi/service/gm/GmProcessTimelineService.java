package com.company.kpi.service.gm;

import com.company.kpi.aggregate.GmTimelineIssueRow;
import com.company.kpi.aggregate.GmUnassignedMemberRow;
import com.company.kpi.common.exception.AppException;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.response.gm.GmProcessTimelineResponse;
import com.company.kpi.response.gm.GmTimelineDepartmentGroupDto;
import com.company.kpi.response.gm.GmTimelineIssueDetailDto;
import com.company.kpi.response.gm.GmTimelineIssueGroupDto;
import com.company.kpi.response.gm.GmTimelineKpiGroupDto;
import com.company.kpi.response.gm.GmTimelinePhaseData;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

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
import java.util.function.Function;

/**
 * Builds Process Timeline data for the GM dashboard — aggregated by operational
 * (business) issues, not one issue per assignment.
 */
@Service
@RequiredArgsConstructor
public class GmProcessTimelineService {

    // ── Setting phase ──────────────────────────────────────────────────────────
    private static final int STATUS_PENDING_ACCEPT = 404;
    private static final int STATUS_ACCEPTED = 405;
    private static final int STATUS_REJECTED = 406;
    private static final int STATUS_FEEDBACK = 407;

    // ── Mid-year phase ─────────────────────────────────────────────────────────
    private static final int STATUS_MID_WAITING_PM = 501;
    private static final int STATUS_MID_WAITING_GM = 502;
    private static final int STATUS_MID_COMPLETED = 503;
    private static final int STATUS_MID_REJECTED = 504;

    // ── Year-end phase ─────────────────────────────────────────────────────────
    private static final int STATUS_END_WAITING_PM = 601;
    private static final int STATUS_END_WAITING_GM = 602;
    private static final int STATUS_END_REJECTED = 604;
    private static final int TYPE_TEAM = 102;

    // ── Stable group ids (aligned with FE / business docs) ───────────────────────
    private static final String ID_SETTING_UNASSIGNED = "setting_unassigned_members";
    private static final String ID_SETTING_PENDING_ACCEPTANCE = "setting_pending_acceptance";
    private static final String ID_SETTING_REJECTED = "setting_rejected";
    private static final String ID_SETTING_FEEDBACK = "setting_feedback";
    private static final String ID_MID_NOT_EVALUATED = "mid_not_evaluated";
    private static final String ID_MID_PENDING_PM_EVALUATION = "mid_pending_pm_evaluation";
    private static final String ID_MID_PENDING_GM_EVALUATION = "mid_pending_gm_evaluation";
    private static final String ID_MID_REJECTED = "mid_rejected";
    private static final String ID_END_NOT_EVALUATED = "end_not_evaluated";
    private static final String ID_END_PENDING_PM_EVALUATION = "end_pending_pm_evaluation";
    private static final String ID_END_PENDING_GM_EVALUATION = "end_pending_gm_evaluation";
    private static final String ID_END_REJECTED = "end_rejected";

    private static final List<String> SETTING_GROUP_ORDER = List.of(
            ID_SETTING_UNASSIGNED,
            ID_SETTING_PENDING_ACCEPTANCE,
            ID_SETTING_REJECTED,
            ID_SETTING_FEEDBACK);

    private static final List<String> MID_GROUP_ORDER = List.of(
            ID_MID_NOT_EVALUATED,
            ID_MID_PENDING_PM_EVALUATION,
            ID_MID_PENDING_GM_EVALUATION,
            ID_MID_REJECTED);

    private static final List<String> YEAR_END_GROUP_ORDER = List.of(
            ID_END_NOT_EVALUATED,
            ID_END_PENDING_PM_EVALUATION,
            ID_END_PENDING_GM_EVALUATION,
            ID_END_REJECTED);

    private final KpiAssignmentMapper kpiAssignmentMapper;
    private final KpiCycleMapper kpiCycleMapper;

    public GmProcessTimelineResponse getTimeline(UUID cycleId) {
        kpiCycleMapper.findById(cycleId)
                .orElseThrow(() -> AppException.notFound("KPI cycle not found: " + cycleId));

        List<GmTimelineIssueRow> allRows = kpiAssignmentMapper.listTimelineAssignments(cycleId);

        List<GmTimelineIssueRow> midNotSubmitted = kpiAssignmentMapper.listInProgressWithinPhaseWindow(
                cycleId, List.of(STATUS_ACCEPTED), "mid");

        List<GmTimelineIssueRow> yearEndNotSubmitted = kpiAssignmentMapper.listInProgressWithinPhaseWindow(
                cycleId, List.of(STATUS_MID_COMPLETED), "yearEnd");

        List<GmUnassignedMemberRow> unassignedMembers = kpiAssignmentMapper.listMembersWithoutKpiAssignment(cycleId);

        GmProcessTimelineResponse response = new GmProcessTimelineResponse();
        response.setSetting(buildSettingPhase(allRows, unassignedMembers));
        response.setMidYear(buildMidYearPhase(allRows, midNotSubmitted));
        response.setYearEnd(buildYearEndPhase(allRows, yearEndNotSubmitted));
        return response;
    }

    /**
     * Same as {@link #getTimeline(UUID)} but scoped to departments where
     * {@code departments.manager_id = pmId}.
     */
    public GmProcessTimelineResponse getTimelineForPm(UUID cycleId, UUID pmId) {
        kpiCycleMapper.findById(cycleId)
                .orElseThrow(() -> AppException.notFound("KPI cycle not found: " + cycleId));

        List<GmTimelineIssueRow> allRows = kpiAssignmentMapper.listTimelineAssignmentsForPm(cycleId, pmId);

        List<GmTimelineIssueRow> midNotSubmitted = kpiAssignmentMapper.listInProgressWithinPhaseWindowForPm(
                cycleId, List.of(STATUS_ACCEPTED), "mid", pmId);

        List<GmTimelineIssueRow> yearEndNotSubmitted = kpiAssignmentMapper.listInProgressWithinPhaseWindowForPm(
                cycleId, List.of(STATUS_MID_COMPLETED), "yearEnd", pmId);

        List<GmUnassignedMemberRow> unassignedMembers = kpiAssignmentMapper
                .listMembersWithoutKpiAssignmentForPm(cycleId, pmId);

        GmProcessTimelineResponse response = new GmProcessTimelineResponse();
        response.setSetting(buildSettingPhase(allRows, unassignedMembers));
        response.setMidYear(buildMidYearPhase(allRows, midNotSubmitted));
        response.setYearEnd(buildYearEndPhase(allRows, yearEndNotSubmitted));
        return response;
    }

    // ── Phase builders ─────────────────────────────────────────────────────────

    private GmTimelinePhaseData buildSettingPhase(
            List<GmTimelineIssueRow> allRows,
            List<GmUnassignedMemberRow> unassignedMembers) {

        Map<String, MutableGroup> groups = new LinkedHashMap<>();

        for (GmUnassignedMemberRow row : unassignedMembers) {
            getOrCreateGroup(groups, ID_SETTING_UNASSIGNED).putBySubjectKey(
                    row.getUserId(),
                    buildUnassignedMemberDetail(row));
        }

        for (GmTimelineIssueRow row : allRows) {
            int code = row.getStatusCode();
            String gid = detectIssueCategorySetting(code);
            if (gid == null) {
                continue;
            }
            getOrCreateGroup(groups, gid).putAssignmentDetail(
                    buildAssignmentDetail(row, "Member", reasonForSetting(code)));
        }

        return finalizePhase(orderedGroups(groups, SETTING_GROUP_ORDER), "KPI Setting");
    }

    private GmTimelinePhaseData buildMidYearPhase(
            List<GmTimelineIssueRow> allRows,
            List<GmTimelineIssueRow> notSubmitted) {

        Map<String, MutableGroup> groups = new LinkedHashMap<>();

        for (GmTimelineIssueRow row : notSubmitted) {
            if (isTeamParentAssignment(row)) {
                continue;
            }
            getOrCreateGroup(groups, ID_MID_NOT_EVALUATED).putAssignmentDetail(
                    buildAssignmentDetail(row, "Member",
                            "Within Mid-Year window but evidence not yet submitted"));
        }

        Set<String> midCompletedSubjects = completedSubjectKeys(allRows, STATUS_MID_COMPLETED);
        for (GmTimelineIssueRow row : allRows) {
            if (isTeamParentAssignment(row)) {
                continue;
            }
            int code = row.getStatusCode();
            if (code != STATUS_MID_WAITING_PM && code != STATUS_MID_WAITING_GM && code != STATUS_MID_REJECTED) {
                continue;
            }
            if (code == STATUS_MID_WAITING_GM && midCompletedSubjects.contains(timelineIssueRowSubjectKey(row))) {
                continue;
            }
            if (code == STATUS_MID_WAITING_PM) {
                getOrCreateGroup(groups, ID_MID_PENDING_PM_EVALUATION).putAssignmentDetail(
                        buildAssignmentDetail(row, "PM", "PM has not reviewed mid-year evidence"));
            } else if (code == STATUS_MID_WAITING_GM) {
                getOrCreateGroup(groups, ID_MID_PENDING_GM_EVALUATION).putAssignmentDetail(
                        buildAssignmentDetail(row, "GM", "GM has not finalized mid-year score"));
            } else {
                getOrCreateGroup(groups, ID_MID_REJECTED).putAssignmentDetail(
                        buildAssignmentDetail(row, "Member", "Mid-year evaluation rejected"));
            }
        }

        return finalizePhase(orderedGroups(groups, MID_GROUP_ORDER), "Mid-Year Review");
    }

    private static Set<String> completedSubjectKeys(List<GmTimelineIssueRow> rows, int completedStatus) {
        Set<String> keys = new HashSet<>();
        for (GmTimelineIssueRow row : rows) {
            if (row != null && row.getStatusCode() == completedStatus) {
                keys.add(timelineIssueRowSubjectKey(row));
            }
        }
        return keys;
    }

    private static String timelineIssueRowSubjectKey(GmTimelineIssueRow row) {
        String assignee = row.getUserId() != null
                ? row.getUserId().toString()
                : String.valueOf(row.getMemberName()).trim().toLowerCase(Locale.ROOT);
        String kpi = row.getMasterKpiId() != null
                ? row.getMasterKpiId().toString()
                : String.valueOf(row.getKpiName()).trim().toLowerCase(Locale.ROOT);
        return assignee + "|" + kpi;
    }

    private GmTimelinePhaseData buildYearEndPhase(
            List<GmTimelineIssueRow> allRows,
            List<GmTimelineIssueRow> notSubmitted) {

        Map<String, MutableGroup> groups = new LinkedHashMap<>();

        for (GmTimelineIssueRow row : notSubmitted) {
            if (isTeamParentAssignment(row)) {
                continue;
            }
            getOrCreateGroup(groups, ID_END_NOT_EVALUATED).putAssignmentDetail(
                    buildAssignmentDetail(row, "Member",
                            "Within Year-End window but evidence not yet submitted"));
        }

        for (GmTimelineIssueRow row : allRows) {
            if (isTeamParentAssignment(row)) {
                continue;
            }
            int code = row.getStatusCode();
            if (code != STATUS_END_WAITING_PM && code != STATUS_END_WAITING_GM && code != STATUS_END_REJECTED) {
                continue;
            }
            if (code == STATUS_END_WAITING_PM) {
                getOrCreateGroup(groups, ID_END_PENDING_PM_EVALUATION).putAssignmentDetail(
                        buildAssignmentDetail(row, "PM", "PM has not completed final evaluation"));
            } else if (code == STATUS_END_WAITING_GM) {
                getOrCreateGroup(groups, ID_END_PENDING_GM_EVALUATION).putAssignmentDetail(
                        buildAssignmentDetail(row, "GM", "GM has not finalized final score"));
            } else {
                getOrCreateGroup(groups, ID_END_REJECTED).putAssignmentDetail(
                        buildAssignmentDetail(row, "Member", "Year-end evaluation rejected"));
            }
        }

        return finalizePhase(orderedGroups(groups, YEAR_END_GROUP_ORDER), "Year-End Review");
    }

    private static boolean isTeamParentAssignment(GmTimelineIssueRow row) {
        return row != null
                && Objects.equals(row.getTypeCode(), TYPE_TEAM)
                && row.getParentAssignmentId() == null;
    }

    private String detectIssueCategorySetting(int code) {
        return switch (code) {
            case STATUS_PENDING_ACCEPT -> ID_SETTING_PENDING_ACCEPTANCE;
            case STATUS_REJECTED -> ID_SETTING_REJECTED;
            case STATUS_FEEDBACK -> ID_SETTING_FEEDBACK;
            default -> null;
        };
    }

    private MutableGroup getOrCreateGroup(Map<String, MutableGroup> map, String groupId) {
        return map.computeIfAbsent(groupId, MutableGroup::new);
    }

    private List<GmTimelineIssueGroupDto> orderedGroups(Map<String, MutableGroup> map, List<String> order) {
        List<GmTimelineIssueGroupDto> out = new ArrayList<>();
        for (String id : order) {
            MutableGroup g = map.get(id);
            if (g != null && !g.isEmpty()) {
                out.add(g.toDto());
            }
        }
        return out;
    }

    /** Timeline button label: «0 issues», «1 issue», «N issues» (issue count only). */
    private static String formatIssueCountLabel(int opCount) {
        if (opCount <= 0) {
            return "0 issues";
        }
        if (opCount == 1) {
            return "1 issue";
        }
        return opCount + " issues";
    }

    private GmTimelinePhaseData finalizePhase(List<GmTimelineIssueGroupDto> groups, String phaseLabelShort) {
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
        int distinctCount = distinctSubjects.size();
        phase.setTotalDistinctEmployeesAffected(distinctCount);
        phase.setHasOpenIssues(opCount > 0);

        String issuesLabel = formatIssueCountLabel(opCount);
        phase.setPendingKpisLine(issuesLabel);
        phase.setPopoverTitle(issuesLabel + " — " + phaseLabelShort);
        return phase;
    }

    private GmTimelineIssueDetailDto buildAssignmentDetail(
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

    private GmTimelineIssueDetailDto buildUnassignedMemberDetail(GmUnassignedMemberRow row) {
        GmTimelineIssueDetailDto d = new GmTimelineIssueDetailDto();
        d.setSubjectUserId(row.getUserId());
        d.setKpi("—");
        d.setMember(row.getFullName());
        d.setRoleCode(row.getRoleCode());
        d.setPm(row.getPmName() != null ? row.getPmName() : "—");
        d.setLeader(row.getLeaderName());
        d.setDepartmentName(row.getDepartmentName());
        d.setBottleneck("Member");
        d.setReason("Members do not have assigned KPIs for this period.");
        return d;
    }

    private String reasonForSetting(int code) {
        return switch (code) {
            case STATUS_PENDING_ACCEPT -> "Member not accepted";
            case STATUS_REJECTED -> "KPI rejected — needs rework";
            case STATUS_FEEDBACK -> "Feedback is being processed";
            default -> "Waiting approval";
        };
    }

    /**
     * Drawer aggregation: KPI (master) → department → assignees.
     * PM/Leader are not set at KPI level — one KPI may span departments; a single
     * dominant PM/supervisor pair for the whole slice would be misleading.
     */
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

    /**
     * Nest child assignments under parent within the same department slice
     * ({@code parent_assignment_id}) so the drawer shows the full cascade (PM → member).
     */
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
            case ID_SETTING_PENDING_ACCEPTANCE -> "Acceptance pending";
            case ID_SETTING_REJECTED -> "Rejected";
            case ID_SETTING_FEEDBACK -> "Feedback in progress";
            case ID_SETTING_UNASSIGNED -> "No KPI assigned";
            case ID_MID_NOT_EVALUATED -> "Mid-year not evaluated";
            case ID_MID_PENDING_PM_EVALUATION -> "Pending PM evaluation";
            case ID_MID_PENDING_GM_EVALUATION -> "Pending GM evaluation";
            case ID_MID_REJECTED -> "Mid-year rejected";
            case ID_END_NOT_EVALUATED -> "Year-end not evaluated";
            case ID_END_PENDING_PM_EVALUATION -> "Pending PM evaluation";
            case ID_END_PENDING_GM_EVALUATION -> "Pending GM evaluation";
            case ID_END_REJECTED -> "Year-end rejected";
            default -> "Action pending";
        };
    }

    /**
     * Most frequent non-blank label (stable: LinkedHashMap iteration order on
     * ties).
     */
    private static String dominantNonBlank(
            List<GmTimelineIssueDetailDto> items, Function<GmTimelineIssueDetailDto, String> getter) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (GmTimelineIssueDetailDto e : items) {
            String v = getter.apply(e);
            if (v == null) {
                continue;
            }
            String t = v.trim();
            if (t.isEmpty() || "—".equals(t)) {
                continue;
            }
            counts.merge(t, 1, Integer::sum);
        }
        return counts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);
    }

    // ── Mutable group accumulator ───────────────────────────────────────────────

    private static final class MutableGroup {
        private final String id;
        private final LinkedHashMap<String, GmTimelineIssueDetailDto> bySubjectKey = new LinkedHashMap<>();

        private MutableGroup(String id) {
            this.id = id;
        }

        void putBySubjectKey(UUID key, GmTimelineIssueDetailDto detail) {
            if (key == null) {
                return;
            }
            bySubjectKey.put("id:" + key, detail);
        }

        void putAssignmentDetail(GmTimelineIssueDetailDto detail) {
            if (detail == null) {
                return;
            }
            bySubjectKey.merge(
                    timelineIssueSubjectKey(detail),
                    detail,
                    GmProcessTimelineService::chooseTimelineIssueDetail);
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
                case ID_SETTING_UNASSIGNED -> new GroupMeta(
                        "Members have not been assigned KPIs",
                        "critical",
                        "Organization",
                        "bg-rose-100 text-rose-600");
                case ID_SETTING_PENDING_ACCEPTANCE -> new GroupMeta(
                        "Pending Acceptance",
                        "info",
                        "Member",
                        "bg-slate-100 text-slate-700");
                case ID_SETTING_REJECTED -> new GroupMeta(
                        "Rejected",
                        "warning",
                        "Member",
                        "bg-orange-100 text-orange-600");
                case ID_SETTING_FEEDBACK -> new GroupMeta(
                        "Feedback In Progress",
                        "warning",
                        "Member",
                        "bg-amber-100 text-amber-700");
                case ID_MID_NOT_EVALUATED -> new GroupMeta(
                        "KPI Not Evaluated (Mid-Year)",
                        "warning",
                        "Member",
                        "bg-orange-100 text-orange-600");
                case ID_MID_PENDING_PM_EVALUATION -> new GroupMeta(
                        "Pending PM Evaluation (Mid-Year)",
                        "warning",
                        "PM",
                        "bg-orange-100 text-orange-600");
                case ID_MID_PENDING_GM_EVALUATION -> new GroupMeta(
                        "Pending GM Evaluation (Mid-Year)",
                        "warning",
                        "GM",
                        "bg-amber-100 text-amber-700");
                case ID_MID_REJECTED -> new GroupMeta(
                        "Rejected (Mid-Year)",
                        "warning",
                        "Member",
                        "bg-rose-100 text-rose-600");
                case ID_END_NOT_EVALUATED -> new GroupMeta(
                        "KPI Not Evaluated (Final)",
                        "warning",
                        "Member",
                        "bg-orange-100 text-orange-600");
                case ID_END_PENDING_PM_EVALUATION -> new GroupMeta(
                        "Pending PM Evaluation (Final)",
                        "warning",
                        "PM",
                        "bg-orange-100 text-orange-600");
                case ID_END_PENDING_GM_EVALUATION -> new GroupMeta(
                        "Pending GM Evaluation (Final)",
                        "warning",
                        "GM",
                        "bg-amber-100 text-amber-700");
                case ID_END_REJECTED -> new GroupMeta(
                        "Rejected (Final)",
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
