package com.company.kpi.service.gm;

import com.company.kpi.common.exception.AppException;
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
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GmKpiDiagnosticsHierarchyService {

    /** {@code kpi_master.type_code} — team / cascading; GM chỉ gán user (PM) trên assignment. */
    private static final int KPI_TYPE_TEAM_CASCADING = 102;

    /** {@code kpi_assignments.status_code >= 503} — coi như đã qua giữa kỳ, dùng tỉ lệ cuối kỳ. */
    private static final int ASSIGNMENT_STATUS_END_PHASE = 503;

    private static final BigDecimal HALF = new BigDecimal("0.5");
    private static final BigDecimal MID_THRESH_HIGH = new BigDecimal("1.10");
    private static final BigDecimal MID_THRESH_LOW = new BigDecimal("0.90");
    private static final BigDecimal END_THRESH_HIGH = BigDecimal.ONE;
    private static final BigDecimal END_THRESH_LOW = new BigDecimal("0.85");

    private record PerfStatus(String status, String label) {}

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

        List<GmDiagPmNode> pmOwners = new ArrayList<>();
        for (Map.Entry<UUID, List<GmDiagnosticsFlatRow>> se : bySection.entrySet()) {
            pmOwners.add(buildPmNode(kpiInfoId, se.getKey(), se.getValue(), first));
        }

        var rollup = rollupFromPmOwners(pmOwners, formatKpiTarget(first));

        String displayName = (first.getKpiCode() != null && !first.getKpiCode().isBlank())
                ? first.getKpiCode() + " · " + first.getKpiName()
                : first.getKpiName();

        String investigateDeptId = kpiRows.get(0).getSectionId() != null
                ? kpiRows.get(0).getSectionId().toString()
                : null;

        long assignmentCount = kpiRows.stream().map(GmDiagnosticsFlatRow::getAssignmentId).filter(Objects::nonNull).count();

        return GmDiagKpiNode.builder()
                .id("diag-kpi-" + kpiInfoId)
                .name(displayName)
                .weight(formatWeight(first.getKpiWeight()))
                .target(formatKpiTarget(first))
                .actual(rollup.actual())
                .status(rollup.status())
                .blockerSummary(pmOwners.size() + " đơn vị · " + assignmentCount + " assignment")
                .kpiType(mapTypeCodeToKpiType(first.getTypeCode()))
                .unitCode(first.getUnitCode())
                .categoryId(first.getCategoryId() != null ? first.getCategoryId().toString() : null)
                .categoryName(first.getCategoryName())
                .lifecycleStatus("active")
                .isImportant(Boolean.TRUE.equals(first.getIsImportant()))
                .pmOwners(pmOwners)
                .investigateDeptId(investigateDeptId)
                .investigateKpiName(first.getKpiName())
                .build();
    }

    private static UUID sectionGroupKey(GmDiagnosticsFlatRow r) {
        UUID sid = r.getSectionId();
        return sid != null ? sid : SECTION_GROUP_FALLBACK;
    }

    private GmDiagPmNode buildPmNode(UUID kpiInfoId, UUID sectionId, List<GmDiagnosticsFlatRow> secRows, GmDiagnosticsFlatRow kpiFirst) {
        if (secRows.stream().allMatch(r -> r.getAssignmentId() == null)) {
            String sectionTargetLabel = formatPmSectionTargetFromRows(secRows, kpiFirst);
            return GmDiagPmNode.builder()
                    .id("diag-pm-unassigned-" + kpiInfoId)
                    .name("Chưa giao")
                    .ownerUserId(null)
                    .ownerRoleCode(null)
                    .ownerRoleLabel(null)
                    .unitLine("—")
                    .target(sectionTargetLabel)
                    .actual("—")
                    .status("warning")
                    .blockerSummary("Chưa có bản ghi giao (kpi_assignments)")
                    .members(List.of())
                    .leaders(null)
                    .build();
        }

        GmDiagnosticsFlatRow sf = secRows.get(0);
        String pmRowId = "diag-pm-" + sectionId + "-" + kpiInfoId;
        Integer kpiTypeCode = kpiFirst.getTypeCode();

        List<GmDiagMemberNode> pmMembers = secRows.stream()
                .map(r -> toMemberNode(r, kpiFirst))
                .collect(Collectors.toList());

        /** Target hiển thị trên dòng PM/đơn vị: từ {@code kpi_assignments.target_value} (flat), không dùng catalog KPI. */
        String sectionTargetLabel = formatPmSectionTargetFromRows(secRows, kpiFirst);

        boolean anyLeaderNames = secRows.stream()
                .anyMatch(r -> r.getLeaderName() != null && !r.getLeaderName().isBlank());
        // Team KPI: leader_name chỉ là supervisor HR, không tạo cây leader giả dưới node PM.
        boolean useLeaderTree = anyLeaderNames && (kpiTypeCode == null || kpiTypeCode != KPI_TYPE_TEAM_CASCADING);

        List<GmDiagLeaderNode> leaders = null;
        List<GmDiagMemberNode> directMembers = pmMembers;
        if (useLeaderTree) {
            PmLeadersSplit split = resolvePmLeadersSplit(
                    pmMembers,
                    pmRowId,
                    sectionTargetLabel,
                    sf.getSectionManagerName(),
                    sf.getSectionManagerId());
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

        // 102: tên node rollup = người trên assignment (member_*), không dùng manager department cha.
        String pmDisplayName = (kpiTypeCode != null && kpiTypeCode == KPI_TYPE_TEAM_CASCADING)
                ? pickTeamAssigneeDisplayName(secRows)
                : pickPmDisplayName(sf);

        String sectionName = sf.getSectionName() != null ? sf.getSectionName() : "—";
        final String ownerRoleCode;
        final String ownerRoleLabel;
        final String unitLine;
        if (kpiTypeCode != null && kpiTypeCode == KPI_TYPE_TEAM_CASCADING) {
            ownerRoleCode = "TEAM";
            ownerRoleLabel = null;
            unitLine = "TEAM · " + sectionName;
        } else {
            ownerRoleCode = normalizedSectionManagerRole(sf);
            ownerRoleLabel = trimOrNull(sf.getSectionManagerRoleName());
            String prefix = roleCodeToUnitLinePrefix(ownerRoleCode);
            unitLine = (prefix != null && !prefix.isBlank()) ? prefix + " · " + sectionName : sectionName;
        }

        List<GmDiagMemberNode> membersForResponse = directMembers;
        if (kpiTypeCode != null
                && kpiTypeCode == KPI_TYPE_TEAM_CASCADING
                && !useLeaderTree
                && directMembers.size() == 1) {
            membersForResponse = List.of();
        }

        String blockerSummary = (kpiTypeCode != null && kpiTypeCode == KPI_TYPE_TEAM_CASCADING)
                ? (pmMembers.size() == 1 ? "1 người nhận KPI" : pmMembers.size() + " người nhận KPI")
                : pmMembers.size() + " thành viên";

        return GmDiagPmNode.builder()
                .id(pmRowId)
                .name(pmDisplayName)
                .ownerUserId(sf.getSectionManagerId() != null ? sf.getSectionManagerId().toString() : null)
                .ownerRoleCode(ownerRoleCode)
                .ownerRoleLabel(ownerRoleLabel)
                .unitLine(unitLine)
                .target(sectionTargetLabel)
                .actual(rollup.actual())
                .status(rollup.status())
                .blockerSummary(blockerSummary)
                .members(membersForResponse)
                .leaders(leaders)
                .build();
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

    private static GmDiagMemberNode toMemberNode(GmDiagnosticsFlatRow r, GmDiagnosticsFlatRow kpiFirst) {
        if (r.getMemberId() == null) {
            String fallbackId = r.getAssignmentId() != null ? r.getAssignmentId().toString() : "unknown";
            return GmDiagMemberNode.builder()
                    .id("diag-member-" + fallbackId)
                    .name("(Không tải được user giao)")
                    .target(formatKpiTarget(kpiFirst))
                    .actual("—")
                    .status("warning")
                    .performanceLabel(null)
                    .blocker("—")
                    .rank(r.getMemberRank())
                    .leader(r.getLeaderName())
                    .ownerRoleCode(null)
                    .ownerRoleLabel(null)
                    .leaderRoleCode(r.getLeaderRoleCode())
                    .leaderRoleName(trimOrNull(r.getLeaderRoleName()))
                    .build();
        }
        PerfStatus perf = computeMemberPerformance(r);
        return GmDiagMemberNode.builder()
                .id(r.getMemberId().toString())
                .name(r.getMemberName())
                .target(formatMemberTarget(r.getMemberTargetValue(), kpiFirst))
                .actual(formatMemberActual(r))
                .status(perf.status())
                .performanceLabel(perf.label())
                .blocker("—")
                .rank(r.getMemberRank())
                .leader(r.getLeaderName())
                .ownerRoleCode(normalizedAssigneeRoleCode(r))
                .ownerRoleLabel(trimOrNull(r.getMemberRoleName()))
                .leaderRoleCode(r.getLeaderRoleCode())
                .leaderRoleName(trimOrNull(r.getLeaderRoleName()))
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
            UUID sectionManagerId) {
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
            var rollup = rollupFromMembers(members, kpiTarget);
            out.add(GmDiagLeaderNode.builder()
                    .id(pmRowId + "-ldr-" + idx + "-" + slug)
                    .name(key)
                    .ownerRoleCode(firstMemberLeaderRoleCode(members))
                    .ownerRoleLabel(firstMemberLeaderRoleName(members))
                    .target(kpiTarget)
                    .actual(rollup.actual())
                    .status(rollup.status())
                    .blockerSummary("")
                    .members(members)
                    .build());
            idx++;
        }

        membersUnderPm = filterDirectMembersNotDuplicatingLeaders(membersUnderPm, subgroupKeys, groups);

        return new PmLeadersSplit(out, membersUnderPm);
    }

    /**
     * Bỏ khỏi nhóm trực tiếp PM những assignee đã xuất hiện trong subtree supervisor (cùng {@code member_id}).
     * Chỉ so UUID — không so tên (tránh đụng đồng danh).
     */
    private static List<GmDiagMemberNode> filterDirectMembersNotDuplicatingLeaders(
            List<GmDiagMemberNode> membersUnderPm,
            List<String> subgroupKeys,
            Map<String, List<GmDiagMemberNode>> groups) {
        if (membersUnderPm.isEmpty() || subgroupKeys.isEmpty()) {
            return membersUnderPm;
        }

        Set<UUID> assigneeIdsInLeaderSubtrees = new HashSet<>();
        for (String leaderKey : subgroupKeys) {
            for (GmDiagMemberNode m : groups.getOrDefault(leaderKey, List.of())) {
                UUID u = memberNodeUuidOrNull(m);
                if (u != null) {
                    assigneeIdsInLeaderSubtrees.add(u);
                }
            }
        }

        List<GmDiagMemberNode> kept = new ArrayList<>(membersUnderPm.size());
        for (GmDiagMemberNode m : membersUnderPm) {
            UUID u = memberNodeUuidOrNull(m);
            if (u == null) {
                kept.add(m);
                continue;
            }
            if (assigneeIdsInLeaderSubtrees.contains(u)) {
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
     * Target trên node PM theo đơn vị: lấy từ {@code member_target_value} (= {@code kpi_assignments.target_value})
     * trên các flat row của section; nếu không có assignment target thì fallback catalog KPI.
     */
    private static String formatPmSectionTargetFromRows(List<GmDiagnosticsFlatRow> secRows, GmDiagnosticsFlatRow kpiFirst) {
        if (secRows == null || secRows.isEmpty()) {
            return formatKpiTarget(kpiFirst);
        }
        List<BigDecimal> vals = new ArrayList<>();
        for (GmDiagnosticsFlatRow r : secRows) {
            if (r.getMemberTargetValue() != null) {
                vals.add(r.getMemberTargetValue().stripTrailingZeros());
            }
        }
        if (vals.isEmpty()) {
            return formatKpiTarget(kpiFirst);
        }
        BigDecimal min = vals.stream().min(BigDecimal::compareTo).orElse(null);
        BigDecimal max = vals.stream().max(BigDecimal::compareTo).orElse(null);
        if (min != null && max != null && min.compareTo(max) == 0) {
            return min.stripTrailingZeros().toPlainString();
        }
        if (min != null && max != null) {
            return min.stripTrailingZeros().toPlainString() + "–" + max.stripTrailingZeros().toPlainString();
        }
        return formatKpiTarget(kpiFirst);
    }

    /**
     * Target (KPI / PM / Leader): {@code kpis_information.target_value} nếu có,
     * không thì {@code kpis_information.target_description}.
     */
    private static String formatKpiTarget(GmDiagnosticsFlatRow r) {
        if (r.getCatalogTargetValue() != null) {
            return r.getCatalogTargetValue().stripTrailingZeros().toPlainString();
        }
        if (r.getKpiTargetDescription() != null && !r.getKpiTargetDescription().isBlank()) {
            return r.getKpiTargetDescription();
        }
        return "—";
    }

    /**
     * Target member: {@code kpi_assignments.target_value} nếu có,
     * không thì cùng thứ tự value → description trên dòng KPI ({@code kpis_information}).
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
        if (isEndPhaseAssignment(r)) {
            BigDecimal endAct = endPhaseDisplayScore(r);
            return endAct != null ? formatScaledOne(endAct) : "—";
        }
        if (r.getMidSelfScore() != null) {
            return formatScaledOne(r.getMidSelfScore());
        }
        return "—";
    }

    /**
     * Traffic-light + nhãn theo quy ước GM: MID — actual/(0.5×annual); END (status ≥ 503) — actual/annual.
     */
    private static PerfStatus computeMemberPerformance(GmDiagnosticsFlatRow r) {
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
