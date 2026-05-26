package com.company.kpi.service.gm;

import com.company.kpi.common.exception.AppException;
import com.company.kpi.util.MemberEvaluationVisibility;
import com.company.kpi.mapper.KpisInformationMapper;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.mapper.KpiInformationMapper;
import com.company.kpi.response.gm.GmDiagKpiNode;
import com.company.kpi.response.gm.GmDiagLeaderNode;
import com.company.kpi.response.gm.GmDiagMemberNode;
import com.company.kpi.response.gm.GmDiagPmNode;
import com.company.kpi.response.gm.GmDiagnosticsFlatRow;
import com.company.kpi.response.gm.GmKpiCatalogItemResponse;
import com.company.kpi.response.gm.GmDiagnosticsHierarchyResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
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
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GmKpiDiagnosticsHierarchyService {

    /** {@code kpi_master.type_code} — team / cascading; GM chỉ gán user (PM) trên assignment. */
    private static final int KPI_TYPE_TEAM_CASCADING = 102;

    /** {@code kpi_assignments.status_code >= 601} — vào phase Final (year-end), dùng tỉ lệ cuối kỳ. */
    private static final int ASSIGNMENT_STATUS_END_PHASE = 601;

    /** GM đã chốt đánh giá giữa kỳ — Diagnostics mới hiển thị Actual member. */
    private static final int ASM_MID_YEAR_GM_COMPLETED = 503;

    private static final BigDecimal HALF = new BigDecimal("0.5");
    private static final BigDecimal MID_THRESH_HIGH = new BigDecimal("1.10");
    private static final BigDecimal MID_THRESH_LOW = new BigDecimal("0.90");
    private static final BigDecimal END_THRESH_HIGH = BigDecimal.ONE;
    private static final BigDecimal END_THRESH_LOW = new BigDecimal("0.85");

    private static final int ASM_FEEDBACK_IN_PROGRESS = 407;

    private static boolean feedbackAwaitingGmForRow(GmDiagnosticsFlatRow r) {
        if (r.getStatusCode() == null || r.getStatusCode() != ASM_FEEDBACK_IN_PROGRESS) {
            return false;
        }
        String c = r.getActiveFeedbackTargetRoleCode();
        return c != null && "GM".equalsIgnoreCase(c.trim());
    }

    /** Dùng so sánh target catalog / nhãn hiển thị với tổng đã giao (tránh nhiễu số thực). */
    private static final BigDecimal TARGET_CMP_EPS = new BigDecimal("0.01");

    /** Nhãn dạng {@code min–max} (en-dash) hoặc {@code min-max} giữa hai số. */
    private static final Pattern TARGET_RANGE_NUMERIC =
            Pattern.compile("^(\\d+(?:\\.\\d+)?)\\s*(?:\u2013|-)\\s*(\\d+(?:\\.\\d+)?)$");

    private record PerfStatus(String status, String label) {}

    /**
     * Số trần đồng bộ chuỗi hiển thị Actual và FE tiến độ ({@code submissionTarget}/{@code submissionActual});
     * chỉ điền trong cửa mid (501–503) hoặc end (≥601).
     */
    private record SubmissionSnapshot(BigDecimal target, BigDecimal actual) {}

    /**
     * Không phải {@code departments.id} thật — chỉ dùng làm khóa {@link Collectors#groupingBy} khi
     * {@code section_id} null (KPI chưa giao hoặc assignee chưa có phòng ban primary). JDK không cho
     * {@code groupingBy} với khóa null.
     */
    private static final UUID SECTION_GROUP_FALLBACK = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final KpiCycleMapper kpiCycleMapper;
    private final KpisInformationMapper kpisInformationMapper;
    private final KpiInformationMapper kpiInformationMapper;
    private final GmDepartmentService gmDepartmentService;

    public GmDiagnosticsHierarchyResponse getHierarchyByYear(int year) {
        var cycle = kpiCycleMapper.findByYear(year)
                .orElseThrow(() -> AppException.notFound("No KPI cycle found for year " + year));

        List<GmDiagnosticsFlatRow> rows = kpisInformationMapper.listDiagnosticsFlatByCycleId(cycle.getId());
        LinkedHashSet<UUID> nullSectionMembers =
                rows.stream()
                        .filter(r -> r.getSectionId() == null && r.getMemberId() != null)
                        .map(GmDiagnosticsFlatRow::getMemberId)
                        .collect(Collectors.toCollection(LinkedHashSet::new));
        int repairedUsers = 0;
        for (UUID memberId : nullSectionMembers) {
            if (gmDepartmentService.ensurePrimaryDepartmentForUser(memberId)) {
                repairedUsers++;
            }
        }
        if (repairedUsers > 0) {
            rows = kpisInformationMapper.listDiagnosticsFlatByCycleId(cycle.getId());
        }

        Integer statusCode = null;
        try {
            statusCode = Integer.parseInt(cycle.getStatus());
        } catch (NumberFormatException ignored) {
            // leave null
        }

        Map<UUID, List<GmDiagnosticsFlatRow>> byKpi = rows.stream()
                .collect(Collectors.groupingBy(GmDiagnosticsFlatRow::getKpiInfoId, LinkedHashMap::new, Collectors.toList()));

        List<Map.Entry<UUID, List<GmDiagnosticsFlatRow>>> ordered = new ArrayList<>(byKpi.entrySet());
        ordered.sort(Comparator.comparing(
                e -> e.getValue().get(0).getKpiCode() == null ? "\uFFFF" : e.getValue().get(0).getKpiCode(),
                String.CASE_INSENSITIVE_ORDER));

        List<GmDiagKpiNode> kpis = new ArrayList<>();
        for (Map.Entry<UUID, List<GmDiagnosticsFlatRow>> e : ordered) {
            GmDiagnosticsFlatRow firstRow = e.getValue().get(0);
            // KPI do non-GM tạo chỉ hiển thị nếu có ít nhất 1 assignment từ trạng thái chờ PM trở đi (status >= 402)
            String creatorRole = firstRow.getCreatorRoleCode();
            if (creatorRole != null && !"GM".equalsIgnoreCase(creatorRole.trim())) {
                boolean meetsDiagnosticsVisibilityThreshold = e.getValue().stream()
                        .anyMatch(r -> r.getStatusCode() != null && r.getStatusCode() >= 402);
                if (!meetsDiagnosticsVisibilityThreshold) {
                    continue; // Bỏ qua KPI này — chưa được GM duyệt
                }
            }
            kpis.add(buildKpiNode(e.getKey(), e.getValue()));
        }

        List<GmKpiCatalogItemResponse> catalogItems = kpiInformationMapper.listCatalogByCycleId(cycle.getId());

        return GmDiagnosticsHierarchyResponse.builder()
                .year(cycle.getYear())
                .cycleId(cycle.getId())
                .cycleName(cycle.getName())
                .cycleStatusCode(statusCode)
                .catalogItems(catalogItems)
                .kpis(kpis)
                .build();
    }

    private GmDiagKpiNode buildKpiNode(UUID kpiInfoId, List<GmDiagnosticsFlatRow> kpiRows) {
        GmDiagnosticsFlatRow first = kpiRows.get(0);
        Map<UUID, List<GmDiagnosticsFlatRow>> bySection = kpiRows.stream()
                .collect(Collectors.groupingBy(GmKpiDiagnosticsHierarchyService::sectionGroupKey, LinkedHashMap::new, Collectors.toList()));

        String kpiWeightDisplay = formatWeight(first.getKpiWeight());

        List<GmDiagPmNode> pmOwners = new ArrayList<>();
        for (Map.Entry<UUID, List<GmDiagnosticsFlatRow>> se : bySection.entrySet()) {
            pmOwners.add(buildPmNode(kpiInfoId, se.getKey(), se.getValue(), first, kpiWeightDisplay));
        }

        // Với INDIVIDUAL/PROMOTION: PM status bị ép cứng = "warning" (supervisor không theo dõi),
        // nên không dùng được để roll-up lên KPI. Thay vào đó roll-up trực tiếp từ member statuses.
        final Rollup rollup;
        if (shouldSuppressSupervisorMetrics(first.getTypeCode())) {
            List<GmDiagMemberNode> allMembers = pmOwners.stream()
                    .flatMap(pm -> allMembersFromPmNode(pm).stream())
                    .collect(Collectors.toList());
            rollup = allMembers.isEmpty()
                    ? rollupFromPmOwners(pmOwners, formatKpiTarget(first))
                    : rollupFromMembers(allMembers, formatKpiTarget(first));
        } else {
            rollup = rollupFromPmOwners(pmOwners, formatKpiTarget(first));
        }

        String displayName = (first.getKpiCode() != null && !first.getKpiCode().isBlank())
                ? first.getKpiCode() + " · " + first.getKpiName()
                : first.getKpiName();

        String investigateDeptId = kpiRows.get(0).getSectionId() != null
                ? kpiRows.get(0).getSectionId().toString()
                : null;

        long assignmentCount = kpiRows.stream().map(GmDiagnosticsFlatRow::getAssignmentId).filter(Objects::nonNull).count();

        // KPI: so catalog với tổng target **theo nhãn từng khối** (5 + 5 = 10), không cộng trùng từng assignment con.
        BigDecimal kpiAllocatedTotal = sumDepartmentTargetsFromPmNodes(pmOwners);
        BigDecimal kpiRefTarget = first.getCatalogTargetValue();
        if (kpiRefTarget == null) {
            kpiRefTarget = tryParseBigDecimalForBalance(formatKpiTarget(first));
        }
        String kpiTargetBalance = classifyNumericBalance(kpiRefTarget, kpiAllocatedTotal);
        // INDIVIDUAL / PROMOTION: mỗi đơn vị nhận đúng target KPI gốc — không so «tổng các khối» với catalog (khác semantics KPI Team).
        if (shouldSuppressSupervisorMetrics(first.getTypeCode())) {
            kpiTargetBalance = null;
        }

        return GmDiagKpiNode.builder()
                .id("diag-kpi-" + kpiInfoId)
                .name(displayName)
                .weight(formatWeight(first.getKpiWeight()))
                .target(formatKpiTarget(first))
                .targetDescription(first.getKpiTargetDescription())
                .targetBalance(kpiTargetBalance)
                .actual(rollup.actual())
                .status(rollup.status())
                .blockerSummary(pmOwners.size() + " đơn vị · " + assignmentCount + " assignment")
                .kpiType(mapTypeCodeToKpiType(first.getTypeCode()))
                .isGlobal(first.getIsGlobal())
                .creatorRoleCode(first.getCreatorRoleCode())
                .unitCode(first.getUnitCode())
                .calculationRuleCode(first.getCalculationRuleCode())
                .calculationTypeCode(first.getCalculationTypeCode())
                .categoryId(first.getCategoryId() != null ? first.getCategoryId().toString() : null)
                .categoryName(first.getCategoryName())
                .lifecycleStatus("active")
                .isImportant(Boolean.TRUE.equals(first.getIsImportant()))
                .pmOwners(pmOwners)
                .investigateDeptId(investigateDeptId)
                .investigateKpiName(first.getKpiName())
                .promotionCycleId(resolvePromotionCycleIdForKpi(first, kpiRows))
                .build();
    }

    /**
     * Thu thập tất cả {@link GmDiagMemberNode} từ một PM node (bao gồm cả members dưới leader subtree).
     * Dùng để roll-up KPI level cho các loại INDIVIDUAL/PROMOTION khi PM status bị suppress.
     */
    private static List<GmDiagMemberNode> allMembersFromPmNode(GmDiagPmNode pm) {
        List<GmDiagMemberNode> result = new ArrayList<>();
        if (pm.getMembers() != null) {
            result.addAll(pm.getMembers());
        }
        if (pm.getLeaders() != null) {
            for (GmDiagLeaderNode leader : pm.getLeaders()) {
                GmDiagMemberNode own = leader.getLeaderOwnRow();
                if (own != null) {
                    result.add(own);
                }
                if (leader.getMembers() != null) {
                    result.addAll(leader.getMembers());
                }
            }
        }
        return result;
    }

    private static UUID sectionGroupKey(GmDiagnosticsFlatRow r) {
        UUID sid = r.getSectionId();
        return sid != null ? sid : SECTION_GROUP_FALLBACK;
    }

    /**
     * Lấy một số từ nhãn target dòng khối để cộng lên KPI: một số thuần, hoặc khoảng {@code min–max} thì lấy {@code max}
     * (trần ngân sách hiển thị cho khối).
     */
    private static BigDecimal parsePmDisplayTargetForKpiRollup(String targetLabel) {
        if (targetLabel == null) {
            return null;
        }
        String d = targetLabel.trim();
        if (d.isEmpty() || "—".equals(d) || "-".equals(d)) {
            return null;
        }
        Matcher rangeMatch = TARGET_RANGE_NUMERIC.matcher(d);
        if (rangeMatch.matches()) {
            BigDecimal min = new BigDecimal(rangeMatch.group(1));
            BigDecimal max = new BigDecimal(rangeMatch.group(2));
            if (min.compareTo(max) > 0) {
                BigDecimal swap = min;
                min = max;
                max = swap;
            }
            return max;
        }
        return tryParseBigDecimalForBalance(d);
    }

    /** Tổng target theo các dòng department (bỏ «Chưa giao») — dùng so với target catalog KPI. */
    private static BigDecimal sumDepartmentTargetsFromPmNodes(List<GmDiagPmNode> pmOwners) {
        if (pmOwners == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal s = BigDecimal.ZERO;
        for (GmDiagPmNode pm : pmOwners) {
            if (pm.getId() != null && pm.getId().startsWith("diag-pm-unassigned-")) {
                continue;
            }
            BigDecimal part = parsePmDisplayTargetForKpiRollup(pm.getTarget());
            if (part != null) {
                s = s.add(part);
            }
        }
        return s;
    }

    private static BigDecimal tryParseBigDecimalForBalance(String raw) {
        if (raw == null) {
            return null;
        }
        String t = raw.trim();
        if (t.isEmpty() || "—".equals(t) || "-".equals(t)) {
            return null;
        }
        try {
            return new BigDecimal(t);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    /**
     * So sánh một mục tiêu tham chiếu (catalog KPI) với tổng target đã giao trên assignment
     * ({@code short} / {@code ok} / {@code excess}).
     */
    private static String classifyNumericBalance(BigDecimal reference, BigDecimal allocatedSum) {
        if (reference == null || allocatedSum == null) {
            return null;
        }
        if (allocatedSum.add(TARGET_CMP_EPS).compareTo(reference) < 0) {
            return "short";
        }
        if (allocatedSum.subtract(TARGET_CMP_EPS).compareTo(reference) > 0) {
            return "excess";
        }
        return "ok";
    }

    /**
     * So nhãn target hiển thị (một số hoặc khoảng {@code min–max}) với tổng đã giao.
     * Khoảng: dưới min → thiếu, trên max → thừa, trong đoạn → đủ.
     */
    private static String classifyDisplayAgainstAllocated(
            String displayTarget, BigDecimal allocatedSum, boolean suppressed) {
        if (suppressed || displayTarget == null) {
            return null;
        }
        String d = displayTarget.trim();
        if (d.isEmpty() || "—".equals(d) || "-".equals(d)) {
            return null;
        }
        BigDecimal allocated = allocatedSum != null ? allocatedSum : BigDecimal.ZERO;
        Matcher rangeMatch = TARGET_RANGE_NUMERIC.matcher(d);
        if (rangeMatch.matches()) {
            BigDecimal min = new BigDecimal(rangeMatch.group(1));
            BigDecimal max = new BigDecimal(rangeMatch.group(2));
            if (min.compareTo(max) > 0) {
                BigDecimal swap = min;
                min = max;
                max = swap;
            }
            if (allocated.add(TARGET_CMP_EPS).compareTo(min) < 0) {
                return "short";
            }
            if (allocated.subtract(TARGET_CMP_EPS).compareTo(max) > 0) {
                return "excess";
            }
            return "ok";
        }
        BigDecimal single = tryParseBigDecimalForBalance(d);
        return classifyNumericBalance(single, allocated);
    }

    private static BigDecimal sumParsedMemberTargets(List<GmDiagMemberNode> members) {
        if (members == null || members.isEmpty()) {
            return BigDecimal.ZERO;
        }
        BigDecimal s = BigDecimal.ZERO;
        for (GmDiagMemberNode mem : members) {
            BigDecimal p = tryParseBigDecimalForBalance(mem.getTarget());
            if (p != null) {
                s = s.add(p);
            }
        }
        return s;
    }

    private static BigDecimal sumDisplayTargetsFromLeaders(List<GmDiagLeaderNode> leaders) {
        if (leaders == null || leaders.isEmpty()) {
            return BigDecimal.ZERO;
        }
        BigDecimal s = BigDecimal.ZERO;
        for (GmDiagLeaderNode leader : leaders) {
            BigDecimal p = parsePmDisplayTargetForKpiRollup(leader.getTarget());
            if (p != null) {
                s = s.add(p);
            }
        }
        return s;
    }

    private static BigDecimal sumImmediateChildTargets(
            List<GmDiagMemberNode> members,
            List<GmDiagLeaderNode> leaders) {
        return sumParsedMemberTargets(members).add(sumDisplayTargetsFromLeaders(leaders));
    }

    private static BigDecimal sumSectionChildTargets(
            List<GmDiagMemberNode> membersForResponse,
            List<GmDiagLeaderNode> leaders) {
        return sumImmediateChildTargets(membersForResponse, leaders);
    }

    /**
     * Assignment gốc GM → PM (slice department): {@code parent_assignment_id} null và assignee là
     * {@code section_manager_id} — không tính vào tổng «đã rollout» khi so với target dòng department.
     */
    private static boolean isRootPmDepartmentBudgetRow(GmDiagMemberNode m, UUID sectionManagerId) {
        if (sectionManagerId == null) {
            return false;
        }
        if (m.getParentAssignmentId() != null && !m.getParentAssignmentId().isBlank()) {
            return false;
        }
        return sectionManagerId.equals(memberNodeUuidOrNull(m));
    }

    /** Hide the GM-to-PM budget row from the response member list while keeping it available for rollup math. */
    private static List<GmDiagMemberNode> filterRootPmDepartmentBudgetRowsForTeamResponse(
            List<GmDiagMemberNode> members,
            UUID sectionManagerId) {
        if (members == null || members.isEmpty() || sectionManagerId == null) {
            return members;
        }
        return members.stream()
                .filter(member -> !isRootPmDepartmentBudgetRow(member, sectionManagerId))
                .collect(Collectors.toList());
    }

    private static GmDiagMemberNode rootPmDepartmentBudgetRow(
            List<GmDiagMemberNode> members,
            UUID sectionManagerId) {
        if (members == null || members.isEmpty() || sectionManagerId == null) {
            return null;
        }
        return members.stream()
                .filter(member -> isRootPmDepartmentBudgetRow(member, sectionManagerId))
                .findFirst()
                .orElse(null);
    }

    /**
     * KPI team: tổng target số trên mọi assignment flat trong section, trừ slice GM→PM gốc — tránh
     * cộng trùng (PM trong __DIRECT__ + leader node parse) làm {@code targetBalance} = excess sai.
     */
    private static BigDecimal sumTeamRolloutTargetsExcludingRootPmSlice(
            List<GmDiagMemberNode> pmMembers, UUID sectionManagerId) {
        if (pmMembers == null || pmMembers.isEmpty()) {
            return BigDecimal.ZERO;
        }
        BigDecimal s = BigDecimal.ZERO;
        for (GmDiagMemberNode m : pmMembers) {
            if (isRootPmDepartmentBudgetRow(m, sectionManagerId)) {
                continue;
            }
            BigDecimal p = tryParseBigDecimalForBalance(m.getTarget());
            if (p != null) {
                s = s.add(p);
            }
        }
        return s;
    }

    /** Chưa có assignment con nào có target số (ngoài slice GM→PM gốc). */
    private static boolean teamHasNoDownstreamNumericTargets(
            List<GmDiagMemberNode> pmMembers, UUID sectionManagerId) {
        if (pmMembers == null) {
            return true;
        }
        for (GmDiagMemberNode m : pmMembers) {
            if (isRootPmDepartmentBudgetRow(m, sectionManagerId)) {
                continue;
            }
            BigDecimal p = tryParseBigDecimalForBalance(m.getTarget());
            if (p != null) {
                return false;
            }
        }
        return true;
    }

    private static BigDecimal rootPmBudgetNumericTarget(List<GmDiagMemberNode> pmMembers, UUID sectionManagerId) {
        if (pmMembers == null) {
            return null;
        }
        for (GmDiagMemberNode m : pmMembers) {
            if (isRootPmDepartmentBudgetRow(m, sectionManagerId)) {
                return tryParseBigDecimalForBalance(m.getTarget());
            }
        }
        return null;
    }

    /**
     * KPI team: khi chưa rollout target số xuống member ({@code sectionAllocated} = 0) nhưng PM đã có slice gốc
     * khớp nhãn department → {@code ok} (pill xanh), tránh «short» chỉ vì tổng con = 0.
     */
    private static String classifyTeamSectionTargetBalance(
            String sectionTargetLabel,
            BigDecimal sectionAllocated,
            List<GmDiagMemberNode> pmMembers,
            UUID sectionManagerId,
            boolean suppressed) {
        if (suppressed) {
            return null;
        }
        if (sectionAllocated.signum() == 0
                && sectionManagerId != null
                && teamHasNoDownstreamNumericTargets(pmMembers, sectionManagerId)) {
            BigDecimal rootT = rootPmBudgetNumericTarget(pmMembers, sectionManagerId);
            if (rootT != null && sectionTargetLabel != null) {
                String d = sectionTargetLabel.trim();
                Matcher rangeMatch = TARGET_RANGE_NUMERIC.matcher(d);
                if (rangeMatch.matches()) {
                    BigDecimal lo = new BigDecimal(rangeMatch.group(1));
                    BigDecimal hi = new BigDecimal(rangeMatch.group(2));
                    if (lo.compareTo(hi) > 0) {
                        BigDecimal swap = lo;
                        lo = hi;
                        hi = swap;
                    }
                    if (rootT.compareTo(lo) >= 0 && rootT.compareTo(hi) <= 0) {
                        return "ok";
                    }
                } else {
                    BigDecimal ref = tryParseBigDecimalForBalance(d);
                    if (ref != null && rootT.compareTo(ref) == 0) {
                        return "ok";
                    }
                }
            }
        }
        return classifyDisplayAgainstAllocated(sectionTargetLabel, sectionAllocated, false);
    }

    private GmDiagPmNode buildPmNode(
            UUID kpiInfoId,
            UUID sectionId,
            List<GmDiagnosticsFlatRow> secRows,
            GmDiagnosticsFlatRow kpiFirst,
            String kpiWeightDisplay) {
        Integer kpiTypeCode = kpiFirst.getTypeCode();
        boolean suppressSupervisorMetrics = shouldSuppressSupervisorMetrics(kpiTypeCode);
        if (secRows.stream().allMatch(r -> r.getAssignmentId() == null)) {
            String sectionTargetLabel =
                    formatPmSectionTargetFromRows(secRows, kpiFirst);
            return GmDiagPmNode.builder()
                    .id("diag-pm-unassigned-" + kpiInfoId)
                    .name("")
                    .ownerUserId(null)
                    .ownerRoleCode(null)
                    .ownerRoleLabel(null)
                    .unitLine("—")
                    .weight(null)
                    .target(sectionTargetLabel)
                    .targetBalance(null)
                    .actual("—")
                    .status("warning")
                    .blockerSummary("Chưa có bản ghi giao (kpi_assignments)")
                    .members(List.of())
                    .leaders(null)
                    .build();
        }

        GmDiagnosticsFlatRow sf = secRows.get(0);
        String pmRowId = "diag-pm-" + sectionId + "-" + kpiInfoId;

        List<GmDiagMemberNode> pmMembers =
                secRows.stream().map(r -> toMemberNode(r, kpiFirst, kpiWeightDisplay)).collect(Collectors.toList());

        /** Target hiển thị trên dòng PM/đơn vị: từ {@code kpi_assignments.target_value} (flat), không dùng catalog KPI. */
        String sectionTargetLabel =
                formatPmSectionTargetFromRows(secRows, kpiFirst);

        boolean anyLeaderNames = secRows.stream()
                .anyMatch(r -> r.getLeaderName() != null && !r.getLeaderName().isBlank());
        // Tạo cây cho mọi loại KPI nếu có supervisor
        boolean useLeaderTree = anyLeaderNames;

        List<GmDiagLeaderNode> leaders = null;
        List<GmDiagMemberNode> directMembers = pmMembers;
        if (useLeaderTree) {
            PmLeadersSplit split = resolvePmLeadersSplit(
                    pmMembers,
                    pmRowId,
                    sectionTargetLabel,
                    sf.getSectionManagerName(),
                    sf.getSectionManagerId(),
                    suppressSupervisorMetrics,
                    kpiWeightDisplay);
            if (split == null) {
                leaders = null;
                directMembers = pmMembers;
            } else {
                leaders = split.leaderSubtrees();
                directMembers = split.membersUnderPm();
            }
        } else {
            leaders = null;
        }

        var rollup = rollupFromMembers(pmMembers, sectionTargetLabel);
        String pmActualLabel = rollup.actual();
        String pmStatus = rollup.status();

        // 102: Không gộp tên assignee vào cùng PM
        String pmDisplayName = pickPmDisplayName(sf);

        String sectionName = sf.getSectionName() != null ? sf.getSectionName() : "—";
        final String ownerRoleCode = normalizedSectionManagerRole(sf);
        final String ownerRoleLabel = trimOrNull(sf.getSectionManagerRoleName());
        String prefix = roleCodeToUnitLinePrefix(ownerRoleCode);
        final String unitLine = (prefix != null && !prefix.isBlank()) ? prefix + " · " + sectionName : sectionName;

        GmDiagMemberNode rootPmFeedbackRow =
                (kpiTypeCode != null && kpiTypeCode == KPI_TYPE_TEAM_CASCADING)
                        ? rootPmDepartmentBudgetRow(pmMembers, sf.getSectionManagerId())
                        : null;

        List<GmDiagMemberNode> membersForResponse = directMembers;
        if (kpiTypeCode != null && kpiTypeCode == KPI_TYPE_TEAM_CASCADING) {
            membersForResponse = filterRootPmDepartmentBudgetRowsForTeamResponse(
                    membersForResponse, sf.getSectionManagerId());
        }

        String blockerSummary = (kpiTypeCode != null && kpiTypeCode == KPI_TYPE_TEAM_CASCADING)
                ? (pmMembers.size() == 1 ? "1 người nhận KPI" : pmMembers.size() + " người nhận KPI")
                : pmMembers.size() + " thành viên";

        BigDecimal sectionAllocated =
                (kpiTypeCode != null && kpiTypeCode == KPI_TYPE_TEAM_CASCADING && sf.getSectionManagerId() != null)
                        ? sumTeamRolloutTargetsExcludingRootPmSlice(pmMembers, sf.getSectionManagerId())
                        : sumSectionChildTargets(membersForResponse, leaders);
        String pmTargetBalance =
                (kpiTypeCode != null && kpiTypeCode == KPI_TYPE_TEAM_CASCADING && sf.getSectionManagerId() != null)
                        ? classifyTeamSectionTargetBalance(
                                sectionTargetLabel,
                                sectionAllocated,
                                pmMembers,
                                sf.getSectionManagerId(),
                                suppressSupervisorMetrics)
                        : classifyDisplayAgainstAllocated(sectionTargetLabel, sectionAllocated, suppressSupervisorMetrics);
        applyPmSelfTargetBalance(membersForResponse, leaders, sf.getSectionManagerId(), suppressSupervisorMetrics);

        return GmDiagPmNode.builder()
                .id(pmRowId)
                .assignmentId(rootPmFeedbackRow != null ? rootPmFeedbackRow.getAssignmentId() : null)
                .assignmentStatusCode(rootPmFeedbackRow != null ? rootPmFeedbackRow.getStatusCode() : null)
                .name(pmDisplayName)
                .ownerUserId(sf.getSectionManagerId() != null ? sf.getSectionManagerId().toString() : null)
                .ownerRoleCode(ownerRoleCode)
                .ownerRoleLabel(ownerRoleLabel)
                .unitLine(unitLine)
                .weight(kpiWeightDisplay)
                .target(sectionTargetLabel)
                .targetBalance(pmTargetBalance)
                .actual(pmActualLabel)
                .status(pmStatus)
                .blockerSummary(blockerSummary)
                .feedbackNote(rootPmFeedbackRow != null ? rootPmFeedbackRow.getFeedbackNote() : null)
                .feedbackAwaitingGm(rootPmFeedbackRow != null && rootPmFeedbackRow.isFeedbackAwaitingGm())
                .members(membersForResponse)
                .leaders(leaders)
                .build();
    }

    private static void applyPmSelfTargetBalance(
            List<GmDiagMemberNode> membersForResponse,
            List<GmDiagLeaderNode> leaders,
            UUID sectionManagerId,
            boolean suppressSupervisorMetrics) {
        if (membersForResponse == null || membersForResponse.isEmpty() || sectionManagerId == null || suppressSupervisorMetrics) {
            return;
        }
        GmDiagMemberNode self = null;
        for (GmDiagMemberNode member : membersForResponse) {
            UUID memberId = memberNodeUuidOrNull(member);
            if (sectionManagerId.equals(memberId)) {
                self = member;
                break;
            }
        }
        if (self == null) {
            return;
        }
        List<GmDiagMemberNode> childMembers = membersForResponse.stream()
                .filter(member -> !sectionManagerId.equals(memberNodeUuidOrNull(member)))
                .collect(Collectors.toList());
        BigDecimal allocated = sumImmediateChildTargets(childMembers, leaders);
        if (allocated.compareTo(BigDecimal.ZERO) == 0) {
            return;
        }
        self.setTargetBalance(classifyDisplayAgainstAllocated(self.getTarget(), allocated, false));
    }

    /** Tên hiển thị trên node PM cho KPI team: đúng danh sách assignee từ flat rows. */
    private static String pickTeamAssigneeDisplayName(List<GmDiagnosticsFlatRow> secRows) {
        LinkedHashSet<String> names = new LinkedHashSet<>();
        for (GmDiagnosticsFlatRow r : secRows) {
            if (r.getMemberName() != null && !r.getMemberName().isBlank()) {
                names.add(r.getMemberName());
            }
        }
        if (names.isEmpty()) {
            return "—";
        }
        return String.join(", ", names);
    }

    /** Tên node PM (non-team): {@code departments.manager_id} của đơn vị assignee (section_manager_*). */
    private static String pickPmDisplayName(GmDiagnosticsFlatRow sf) {
        if (sf.getSectionManagerName() != null && !sf.getSectionManagerName().isBlank()) {
            return sf.getSectionManagerName();
        }
        return "—";
    }

    private static String normalizedAssigneeRoleCode(GmDiagnosticsFlatRow r) {
        if (r.getMemberId() == null) {
            return null;
        }
        String c = r.getMemberRoleCode();
        if (c == null || c.isBlank()) {
            return null;
        }
        return c.trim().toUpperCase(Locale.ROOT);
    }

    private static String trimOrNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    /** {@code promotion_cycle_id} chỉ khi KPI promotion (103); lấy từ assignment row đầu tiên có giá trị. */
    private static UUID resolvePromotionCycleIdForKpi(
            GmDiagnosticsFlatRow first, List<GmDiagnosticsFlatRow> kpiRows) {
        if (first.getTypeCode() == null || first.getTypeCode() != 103) {
            return null;
        }
        for (GmDiagnosticsFlatRow row : kpiRows) {
            if (row.getPromotionCycleId() != null) {
                return row.getPromotionCycleId();
            }
        }
        return null;
    }

    private static UUID promotionCycleIdForMemberRow(GmDiagnosticsFlatRow r, GmDiagnosticsFlatRow kpiFirst) {
        if (kpiFirst.getTypeCode() == null || kpiFirst.getTypeCode() != 103) {
            return null;
        }
        return r.getPromotionCycleId();
    }

    private static SubmissionSnapshot computeSubmissionSnapshot(GmDiagnosticsFlatRow r) {
        if (!isMidPhaseAssignment(r) && !isEndPhaseAssignment(r)) {
            return new SubmissionSnapshot(null, null);
        }
        BigDecimal target = annualTargetForRatio(r);
        BigDecimal actual = null;
        if (isEndPhaseAssignment(r)) {
            actual = endPhaseDisplayScore(r);
        } else if (canDiagnosticsShowMemberActual(r.getStatusCode())) {
            actual = r.getMidSelfScore() != null ? r.getMidSelfScore() : r.getEndSelfScore();
        }
        return new SubmissionSnapshot(target, actual);
    }

    private static GmDiagMemberNode toMemberNode(
            GmDiagnosticsFlatRow r, GmDiagnosticsFlatRow kpiFirst, String kpiWeightDisplay) {
        SubmissionSnapshot ss = computeSubmissionSnapshot(r);
        if (r.getMemberId() == null) {
            String fallbackId = r.getAssignmentId() != null ? r.getAssignmentId().toString() : "unknown";
            return GmDiagMemberNode.builder()
                    .id("diag-member-" + fallbackId)
                    .assignmentId(r.getAssignmentId() != null ? r.getAssignmentId().toString() : null)
                    .parentAssignmentId(r.getParentAssignmentId() != null ? r.getParentAssignmentId().toString() : null)
                    .name("(Không tải được user giao)")
                    .weight(kpiWeightDisplay)
                    .statusCode(r.getStatusCode())
                    .target(formatKpiTarget(kpiFirst))
                    .actual("—")
                    .status("danger")
                    .performanceLabel("Không xác định")
                    .blocker("—")
                    .rank(r.getMemberRank())
                    .rankCode(r.getMemberRankCode())
                    .leader(r.getLeaderName())
                    .ownerRoleCode(null)
                    .ownerRoleLabel(null)
                    .leaderRoleCode(r.getLeaderRoleCode())
                    .leaderRoleName(trimOrNull(r.getLeaderRoleName()))
                    .submissionTarget(ss.target())
                    .submissionActual(ss.actual())
                    .evidences(canDiagnosticsShowMemberActual(r.getStatusCode()) ? r.getEvidences() : null)
                    .feedbackNote(trimOrNull(r.getFeedbackNote()))
                    .evaluationSupervisorComments(trimOrNull(r.getEvaluationSupervisorComments()))
                    .feedbackAwaitingGm(feedbackAwaitingGmForRow(r))
                    .promotionCycleId(promotionCycleIdForMemberRow(r, kpiFirst))
                    .build();
        }
        PerfStatus perf = computeMemberPerformance(r);
        boolean showMemberActual = canDiagnosticsShowMemberActual(r.getStatusCode());
        return GmDiagMemberNode.builder()
                .id(r.getMemberId().toString())
                .assignmentId(r.getAssignmentId() != null ? r.getAssignmentId().toString() : null)
                .parentAssignmentId(r.getParentAssignmentId() != null ? r.getParentAssignmentId().toString() : null)
                .name(r.getMemberName())
                .weight(kpiWeightDisplay)
                .statusCode(r.getStatusCode())
                .target(formatMemberTarget(r.getMemberTargetValue(), kpiFirst))
                .actual(formatMemberActual(r))
                .status(perf.status())
                .performanceLabel(perf.label())
                .blocker("—")
                .rank(r.getMemberRank())
                .rankCode(r.getMemberRankCode())
                .leader(r.getLeaderName())
                .ownerRoleCode(normalizedAssigneeRoleCode(r))
                .ownerRoleLabel(trimOrNull(r.getMemberRoleName()))
                .leaderRoleCode(r.getLeaderRoleCode())
                .leaderRoleName(trimOrNull(r.getLeaderRoleName()))
                .submissionTarget(ss.target())
                .submissionActual(ss.actual())
                .evidences(showMemberActual ? r.getEvidences() : null)
                .feedbackNote(trimOrNull(r.getFeedbackNote()))
                .evaluationSupervisorComments(trimOrNull(r.getEvaluationSupervisorComments()))
                .feedbackAwaitingGm(feedbackAwaitingGmForRow(r))
                .promotionCycleId(promotionCycleIdForMemberRow(r, kpiFirst))
                .build();
    }

    private static String normalizedSectionManagerRole(GmDiagnosticsFlatRow sf) {
        String c = sf.getSectionManagerRoleCode();
        if (c == null || c.isBlank()) {
            return null;
        }
        return c.trim().toUpperCase(Locale.ROOT);
    }

    /** Phần trước « · » trong {@code unitLine} — chỉ {@code roles.code} (hiển thị chữ). */
    private static String roleCodeToUnitLinePrefix(String roleCode) {
        if (roleCode == null || roleCode.isBlank()) {
            return "";
        }
        return roleCode.trim().toUpperCase(Locale.ROOT);
    }

    private static String normalizePersonNameKey(String name) {
        if (name == null) {
            return "";
        }
        String trimmed = name.trim();
        if (trimmed.isEmpty()) {
            return "";
        }
        return Normalizer.normalize(trimmed, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ");
    }

    /**
     * Khóa nhóm supervisor:
     * <ul>
     *   <li>Assignee là manager phòng ({@code member_id = section_manager_id}) → {@code __DIRECT__}
     *       (không lồng «PM rollup» dưới nhóm supervisor HR như GM).</li>
     *   <li>Supervisor trùng tên manager phòng → {@code __DIRECT__}.</li>
     * </ul>
     */
    private static String leaderGroupKey(
            String leaderRaw,
            String sectionManagerName,
            UUID memberId,
            UUID sectionManagerId) {
        if (memberId != null && sectionManagerId != null && memberId.equals(sectionManagerId)) {
            return "__DIRECT__";
        }
        if (leaderRaw == null || leaderRaw.isBlank()) {
            return "__DIRECT__";
        }
        String mgrKey = normalizePersonNameKey(sectionManagerName);
        if (!mgrKey.isEmpty() && normalizePersonNameKey(leaderRaw).equals(mgrKey)) {
            return "__DIRECT__";
        }
        return leaderRaw.trim();
    }

    private static UUID memberNodeUuidOrNull(GmDiagMemberNode m) {
        if (m.getId() == null) {
            return null;
        }
        try {
            return UUID.fromString(m.getId().trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static String firstMemberLeaderRoleCode(List<GmDiagMemberNode> members) {
        for (GmDiagMemberNode m : members) {
            String c = m.getLeaderRoleCode();
            if (c != null && !c.isBlank()) {
                return c.trim().toUpperCase(Locale.ROOT);
            }
        }
        return null;
    }

    private static String firstMemberLeaderRoleName(List<GmDiagMemberNode> members) {
        for (GmDiagMemberNode m : members) {
            String n = m.getLeaderRoleName();
            if (n != null && !n.isBlank()) {
                return n.trim();
            }
        }
        return null;
    }

    /** Dòng assignment của chính supervisor — trong {@code pmMembers}, nhóm subtree chỉ chứa báo cáo viên. */
    private static GmDiagMemberNode findLeaderOwnRow(List<GmDiagMemberNode> pmMembers, String leaderGroupKey) {
        String keyNorm = normalizePersonNameKey(leaderGroupKey);
        if (keyNorm.isEmpty()) {
            return null;
        }
        for (GmDiagMemberNode m : pmMembers) {
            if (normalizePersonNameKey(m.getName()).equals(keyNorm)) {
                return m;
            }
        }
        return null;
    }

    /**
     * Nhánh leader (theo tên supervisor) + assignee gom trực tiếp dưới dòng khối (không tạo node giả «Trực tiếp PM»).
     *
     * @return {@code null} nếu toàn bộ assignee thuộc một nhóm trực tiếp — caller hiển thị phẳng.
     */
    private record PmLeadersSplit(List<GmDiagLeaderNode> leaderSubtrees, List<GmDiagMemberNode> membersUnderPm) {}

    private PmLeadersSplit resolvePmLeadersSplit(
            List<GmDiagMemberNode> pmMembers,
            String pmRowId,
            String kpiTarget,
            String sectionManagerName,
            UUID sectionManagerId,
            boolean suppressSupervisorMetrics,
            String kpiWeightDisplay) {
        Map<String, List<GmDiagMemberNode>> groups = new LinkedHashMap<>();
        for (GmDiagMemberNode mem : pmMembers) {
            String key = leaderGroupKey(
                    mem.getLeader(),
                    sectionManagerName,
                    memberNodeUuidOrNull(mem),
                    sectionManagerId);
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(mem);
        }

        if (groups.size() == 1 && groups.containsKey("__DIRECT__")) {
            return null;
        }

        List<GmDiagMemberNode> membersUnderPm = new ArrayList<>(groups.getOrDefault("__DIRECT__", List.of()));

        List<String> subgroupKeys = groups.keySet().stream()
                .filter(k -> !"__DIRECT__".equals(k))
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .collect(Collectors.toCollection(ArrayList::new));

        List<GmDiagLeaderNode> out = new ArrayList<>();
        int idx = 0;
        for (String key : subgroupKeys) {
            List<GmDiagMemberNode> members = groups.get(key);
            String slug = slug(key, idx);
            GmDiagMemberNode leaderOwnRow = findLeaderOwnRow(pmMembers, key);
            // Dòng LEADER trên diagnostics = KPI của chính supervisor (leaderOwnRow), không rollup nhóm member.
            final String leaderTargetLabel;
            final String leaderActualLabel;
            final String leaderStatus;
            final String leaderTargetBalance;
            if (suppressSupervisorMetrics) {
                leaderTargetLabel = "—";
                leaderActualLabel = "—";
                leaderStatus = "warning";
                leaderTargetBalance = null;
            } else if (leaderOwnRow != null) {
                leaderTargetLabel = leaderOwnRow.getTarget();
                leaderActualLabel = leaderOwnRow.getActual();
                leaderStatus = leaderOwnRow.getStatus();
                leaderTargetBalance = leaderOwnRow.getTargetBalance();
            } else {
                leaderTargetLabel = "—";
                leaderActualLabel = "—";
                leaderStatus = "warning";
                leaderTargetBalance = null;
            }
            out.add(GmDiagLeaderNode.builder()
                    .id(pmRowId + "-ldr-" + idx + "-" + slug)
                    .name(key)
                    .ownerRoleCode(firstMemberLeaderRoleCode(members))
                    .ownerRoleLabel(firstMemberLeaderRoleName(members))
                    .weight(kpiWeightDisplay)
                    .target(leaderTargetLabel)
                    .targetBalance(leaderTargetBalance)
                    .actual(leaderActualLabel)
                    .status(leaderStatus)
                    .blockerSummary("")
                    .leaderOwnRow(leaderOwnRow)
                    .members(members)
                    .build());
            idx++;
        }

        membersUnderPm = filterDirectMembersNotDuplicatingLeaders(membersUnderPm, subgroupKeys, groups, sectionManagerName, sectionManagerId);

        return new PmLeadersSplit(out, membersUnderPm);
    }

    /**
     * Bỏ khỏi nhóm trực tiếp PM những assignee đã xuất hiện trong subtree supervisor (cùng {@code member_id}).
     * Chỉ so UUID — không so tên (tránh đụng đồng danh).
     */
    private static List<GmDiagMemberNode> filterDirectMembersNotDuplicatingLeaders(
            List<GmDiagMemberNode> membersUnderPm,
            List<String> subgroupKeys,
            Map<String, List<GmDiagMemberNode>> groups,
            String sectionManagerName,
            UUID sectionManagerId) {
        if (membersUnderPm.isEmpty() || subgroupKeys.isEmpty()) {
            return membersUnderPm;
        }

        // Lọc theo UUID của member dưới leader subtrees
        Set<UUID> assigneeIdsInLeaderSubtrees = new HashSet<>();
        for (String leaderKey : subgroupKeys) {
            for (GmDiagMemberNode m : groups.getOrDefault(leaderKey, List.of())) {
                UUID u = memberNodeUuidOrNull(m);
                if (u != null) {
                    assigneeIdsInLeaderSubtrees.add(u);
                }
            }
        }

        // Chuẩn hóa tên leader để so sánh (loại bỏ người đã có leader node)
        Set<String> leaderNodeNameKeys = new HashSet<>();
        for (String key : subgroupKeys) {
            leaderNodeNameKeys.add(normalizePersonNameKey(key));
        }

        List<GmDiagMemberNode> kept = new ArrayList<>(membersUnderPm.size());
        for (GmDiagMemberNode m : membersUnderPm) {
            UUID u = memberNodeUuidOrNull(m);

            // Loại bỏ nếu UUID đã nằm trong subtree của leader
            if (u != null && assigneeIdsInLeaderSubtrees.contains(u)) {
                continue;
            }

            // Loại bỏ nếu tên của member này CHÍNH LÀ tên của một leader node
            // (Tran Leader 1 có assignment riêng nhưng cũng là supervisor → không hiện ở flat list)
            String memberNameKey = normalizePersonNameKey(m.getName());
            if (!memberNameKey.isEmpty() && leaderNodeNameKeys.contains(memberNameKey)) {
                continue;
            }

            kept.add(m);
        }
        return kept;
    }

    private static String slug(String key, int idx) {
        if ("__DIRECT__".equals(key)) {
            return "direct";
        }
        String ascii = Normalizer.normalize(key, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+", "")
                .replaceAll("-+$", "");
        String s = ascii.length() > 28 ? ascii.substring(0, 28) : ascii;
        return s.isEmpty() ? "g" + idx : s;
    }

    private record Rollup(String status, String actual) {}

    private static Rollup rollupFromMembers(List<GmDiagMemberNode> members, String fallbackActual) {
        if (members.isEmpty()) {
            return new Rollup("success", fallbackActual != null ? fallbackActual : "—");
        }
        boolean danger = members.stream().anyMatch(m -> "danger".equals(m.getStatus()));
        boolean warn = members.stream().anyMatch(m -> "warning".equals(m.getStatus()));
        String status = danger ? "danger" : warn ? "warning" : "success";

        List<BigDecimal> nums = new ArrayList<>();
        for (GmDiagMemberNode m : members) {
            String a = m.getActual();
            if (a != null && !a.isBlank() && !"—".equals(a)) {
                try {
                    nums.add(new BigDecimal(a));
                } catch (NumberFormatException ignored) {
                    // skip non-numeric
                }
            }
        }
        if (!nums.isEmpty()) {
            BigDecimal sum = nums.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal avg = sum.divide(BigDecimal.valueOf(nums.size()), 1, RoundingMode.HALF_UP);
            return new Rollup(status, avg.toPlainString());
        }
        return new Rollup(status, members.get(0).getActual() != null ? members.get(0).getActual() : fallbackActual);
    }

    private static Rollup rollupFromPmOwners(List<GmDiagPmNode> pmOwners, String fallbackActual) {
        if (pmOwners.isEmpty()) {
            return new Rollup("success", fallbackActual != null ? fallbackActual : "—");
        }
        boolean danger = pmOwners.stream().anyMatch(p -> "danger".equals(p.getStatus()));
        boolean warn = pmOwners.stream().anyMatch(p -> "warning".equals(p.getStatus()));
        String status = danger ? "danger" : warn ? "warning" : "success";

        List<BigDecimal> nums = new ArrayList<>();
        for (GmDiagPmNode p : pmOwners) {
            String a = p.getActual();
            if (a != null && !a.isBlank() && !"—".equals(a)) {
                try {
                    nums.add(new BigDecimal(a));
                } catch (NumberFormatException ignored) {
                    // skip
                }
            }
        }
        if (!nums.isEmpty()) {
            BigDecimal sum = nums.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal avg = sum.divide(BigDecimal.valueOf(nums.size()), 1, RoundingMode.HALF_UP);
            return new Rollup(status, avg.toPlainString());
        }
        return new Rollup(status, pmOwners.get(0).getActual() != null ? pmOwners.get(0).getActual() : fallbackActual);
    }

    /**
     * Target trên node PM/section (Team KPI):
     * <ul>
     *   <li>Ưu tiên: assignment gốc của PM đơn vị ({@code parent_assignment_id} null, assignee = {@code section_manager_id})
     *       — đúng mức GM đã giao cho department đó ({@code kpi_assignments.target_value}).</li>
     *   <li>Không có slice PM gốc: min–max / tổng của {@code member_target_value} theo assignment (dedupe {@code assignment_id}).</li>
     *   <li>Không có target assignment thì fallback catalog KPI.</li>
     * </ul>
     */
    private static String formatPmSectionTargetFromRows(List<GmDiagnosticsFlatRow> secRows, GmDiagnosticsFlatRow kpiFirst) {
        if (secRows == null || secRows.isEmpty()) {
            return formatKpiTarget(kpiFirst);
        }
        Integer tc = kpiFirst.getTypeCode();
        if (tc != null && tc == KPI_TYPE_TEAM_CASCADING) {
            for (GmDiagnosticsFlatRow r : secRows) {
                if (r.getSectionAssignedTargetValue() != null) {
                    return r.getSectionAssignedTargetValue().stripTrailingZeros().toPlainString();
                }
            }
        }
        List<BigDecimal> vals = new ArrayList<>();
        LinkedHashSet<UUID> seenAssignment = new LinkedHashSet<>();
        for (GmDiagnosticsFlatRow r : secRows) {
            if (r.getMemberTargetValue() == null) {
                continue;
            }
            UUID aid = r.getAssignmentId();
            if (aid != null && !seenAssignment.add(aid)) {
                continue;
            }
            vals.add(r.getMemberTargetValue().stripTrailingZeros());
        }
        if (vals.isEmpty()) {
            return formatKpiTarget(kpiFirst);
        }
        BigDecimal min = vals.stream().min(BigDecimal::compareTo).orElse(null);
        BigDecimal max = vals.stream().max(BigDecimal::compareTo).orElse(null);
        if (min != null && max != null && min.compareTo(max) == 0) {
            if (vals.size() > 1) {
                BigDecimal sum = vals.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
                return sum.stripTrailingZeros().toPlainString();
            }
            return min.stripTrailingZeros().toPlainString();
        }
        if (min != null && max != null) {
            return min.stripTrailingZeros().toPlainString() + "–" + max.stripTrailingZeros().toPlainString();
        }
        return formatKpiTarget(kpiFirst);
    }

    /**
     * Target trên node Leader: chỉ tính trong subtree của leader đó (không lấy toàn section).
     * Nếu nhiều member cùng một số target thì hiển thị tổng (vd hai dòng 3 → «6»); khác nhau thì min–max.
     */
    private static String formatGroupTargetFromMemberNodes(List<GmDiagMemberNode> members, String fallbackTarget) {
        if (members == null || members.isEmpty()) {
            return fallbackTarget != null ? fallbackTarget : "—";
        }
        List<BigDecimal> vals = new ArrayList<>();
        LinkedHashSet<String> seenAssignment = new LinkedHashSet<>();
        for (GmDiagMemberNode m : members) {
            String raw = m.getTarget();
            if (raw == null) {
                continue;
            }
            String t = raw.trim();
            if (t.isEmpty() || "—".equals(t) || "-".equals(t)) {
                continue;
            }
            String aid = m.getAssignmentId();
            if (aid != null && !aid.isBlank()) {
                if (!seenAssignment.add(aid.trim())) {
                    continue;
                }
            }
            try {
                vals.add(new BigDecimal(t).stripTrailingZeros());
            } catch (NumberFormatException ignored) {
                // Nhóm target có text không phải số (vd mô tả) -> fallback về target hiện có.
            }
        }
        if (vals.isEmpty()) {
            return fallbackTarget != null ? fallbackTarget : "—";
        }
        BigDecimal min = vals.stream().min(BigDecimal::compareTo).orElse(null);
        BigDecimal max = vals.stream().max(BigDecimal::compareTo).orElse(null);
        if (min != null && max != null && min.compareTo(max) == 0) {
            if (vals.size() > 1) {
                BigDecimal sum = vals.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
                return sum.stripTrailingZeros().toPlainString();
            }
            return min.toPlainString();
        }
        if (min != null && max != null) {
            return min.toPlainString() + "–" + max.toPlainString();
        }
        return fallbackTarget != null ? fallbackTarget : "—";
    }

    /**
     * Target (KPI / PM / Leader) hiển thị: chỉ {@code kpis_information.target_value} (catalog).
     * Không có số mục tiêu → «-» (không hiển thị {@code target_description} — thường là JSON quy tắc chấm điểm).
     */
    private static String formatKpiTarget(GmDiagnosticsFlatRow r) {
        if (r.getCatalogTargetValue() != null) {
            return r.getCatalogTargetValue().stripTrailingZeros().toPlainString();
        }
        return "-";
    }

    private static boolean shouldSuppressSupervisorMetrics(Integer typeCode) {
        return typeCode != null && (typeCode == 101 || typeCode == 103);
    }

    /**
     * Target member: {@code kpi_assignments.target_value} nếu có,
     * không thì fallback nhãn catalog KPI ({@link #formatKpiTarget} — «-» nếu không có target số).
     */
    private static String formatMemberTarget(BigDecimal memberTarget, GmDiagnosticsFlatRow kpiFirst) {
        if (memberTarget != null) {
            return memberTarget.stripTrailingZeros().toPlainString();
        }
        return formatKpiTarget(kpiFirst);
    }

    private static boolean isEndPhaseAssignment(GmDiagnosticsFlatRow r) {
        return r.getStatusCode() != null && r.getStatusCode() >= ASSIGNMENT_STATUS_END_PHASE;
    }

    private static boolean isMidPhaseAssignment(GmDiagnosticsFlatRow r) {
        if (r.getStatusCode() == null) return false;
        int sc = r.getStatusCode();
        return sc >= 501 && sc <= 503;
    }

    /** Strategic KPIs Diagnostics: Actual member chỉ khi GM đã chốt — ASM 503 hoặc 603. */
    private static boolean canDiagnosticsShowMemberActual(Integer statusCode) {
        return MemberEvaluationVisibility.canDiagnosticsShowMemberActual(statusCode);
    }

    private static BigDecimal firstNonNull(BigDecimal... vals) {
        for (BigDecimal v : vals) {
            if (v != null) {
                return v;
            }
        }
        return null;
    }

    /** Điểm “actual” cuối kỳ: GM → PM → self. */
    private static BigDecimal endPhaseDisplayScore(GmDiagnosticsFlatRow r) {
        return firstNonNull(r.getEndGmScore(), r.getEndPmScore(), r.getEndSelfScore());
    }

    /** Mục tiêu năm cho tỉ lệ: ưu tiên target assignment, không thì catalog KPI. */
    private static BigDecimal annualTargetForRatio(GmDiagnosticsFlatRow r) {
        if (r.getMemberTargetValue() != null && r.getMemberTargetValue().compareTo(BigDecimal.ZERO) > 0) {
            return r.getMemberTargetValue();
        }
        if (r.getCatalogTargetValue() != null && r.getCatalogTargetValue().compareTo(BigDecimal.ZERO) > 0) {
            return r.getCatalogTargetValue();
        }
        return null;
    }

    private static String formatScaledOne(BigDecimal v) {
        return v.setScale(1, RoundingMode.HALF_UP).toPlainString();
    }

    private static String formatMemberActual(GmDiagnosticsFlatRow r) {
        if (!canDiagnosticsShowMemberActual(r.getStatusCode())) {
            return "—";
        }
        if (isEndPhaseAssignment(r)) {
            BigDecimal endAct = endPhaseDisplayScore(r);
            return endAct != null ? formatScaledOne(endAct) : "—";
        }
        if (isMidPhaseAssignment(r)) {
            BigDecimal midAct =
                    r.getMidSelfScore() != null ? r.getMidSelfScore() : r.getEndSelfScore();
            return midAct != null ? formatScaledOne(midAct) : "—";
        }
        return "—";
    }

    /**
     * Traffic-light + nhãn theo quy ước GM:
     * MID (501/502/503) — actual/(0.5×annual);
     * END (601/602/603) — actual/annual.
     */
    private static PerfStatus computeMemberPerformance(GmDiagnosticsFlatRow r) {
        if (!isMidPhaseAssignment(r) && !isEndPhaseAssignment(r)) {
            return new PerfStatus("warning", "Chờ kỳ đánh giá");
        }

        BigDecimal annual = annualTargetForRatio(r);
        if (annual == null) {
            return new PerfStatus("warning", "Chưa cấu hình mục tiêu");
        }

        if (isEndPhaseAssignment(r)) {
            BigDecimal endAct = endPhaseDisplayScore(r);
            if (endAct == null) {
                return new PerfStatus("warning", "Chưa có điểm cuối kỳ");
            }
            BigDecimal progress = endAct.divide(annual, 6, RoundingMode.HALF_UP);
            if (progress.compareTo(END_THRESH_HIGH) >= 0) {
                String label = progress.compareTo(BigDecimal.ONE) > 0 ? "Vượt mục tiêu" : "Đạt mục tiêu";
                return new PerfStatus("success", label);
            }
            if (progress.compareTo(END_THRESH_LOW) < 0) {
                return new PerfStatus("danger", "Không đạt");
            }
            return new PerfStatus("warning", "Gần đạt");
        }

        BigDecimal midAct = r.getMidSelfScore();
        if (midAct == null) {
            return new PerfStatus("warning", "Chưa có điểm giữa kỳ");
        }
        BigDecimal halfTarget = annual.multiply(HALF);
        if (halfTarget.compareTo(BigDecimal.ZERO) <= 0) {
            return new PerfStatus("warning", "Chưa cấu hình mục tiêu");
        }
        BigDecimal ratio = midAct.divide(halfTarget, 6, RoundingMode.HALF_UP);
        if (ratio.compareTo(MID_THRESH_HIGH) >= 0) {
            return new PerfStatus("success", "Vượt tiến độ");
        }
        if (ratio.compareTo(MID_THRESH_LOW) >= 0) {
            return new PerfStatus("warning", "Đúng tiến độ");
        }
        return new PerfStatus("danger", "Chậm tiến độ");
    }

    private static String formatWeight(BigDecimal w) {
        if (w == null) {
            return "—";
        }
        return w.stripTrailingZeros().toPlainString() + "%";
    }

    private static String mapTypeCodeToKpiType(Integer typeCode) {
        if (typeCode == null) {
            return "individual";
        }
        return switch (typeCode) {
            case 102 -> "cascading";
            case 103 -> "promotion";
            default -> "individual";
        };
    }

}
