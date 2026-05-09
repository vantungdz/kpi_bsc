package com.company.kpi.service.kpi;

import com.company.kpi.aggregate.KpiAssignmentInsertRow;
import com.company.kpi.aggregate.KpiAssignmentUserTargetRow;
import com.company.kpi.aggregate.KpiInfoForDeleteRow;
import com.company.kpi.aggregate.KpiStrategicEditMasterRow;
import com.company.kpi.aggregate.UserJobTitlePair;
import com.company.kpi.common.constant.Constant;
import com.company.kpi.common.Constants;
import com.company.kpi.common.exception.AppException;
import com.company.kpi.dto.kpi.KpiScoringRulesPayload;
import com.company.kpi.entity.KpiAssignment;
import com.company.kpi.mapper.*;
import com.company.kpi.request.kpi.AssignMemberRequest;
import com.company.kpi.request.kpi.CreateStrategicKpiRequest;
import com.company.kpi.request.kpi.UpdateKpiStatusRequest;
import com.company.kpi.response.gm.GmKpiCategoryResponse;
import com.company.kpi.response.kpi.StrategicKpiEditResponse;
import com.company.kpi.response.kpi.StrategicKpiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Quản lý KPI chiến lược (tạo, sửa, xóa, load form sửa).
 * Được chia sẻ cho nhiều role (GM, PM, ...).
 */
@Service
@RequiredArgsConstructor
public class StrategicKpiService {

    private static final int TYPE_INDIVIDUAL = 101;
    private static final int TYPE_TEAM = 102;
    private static final int TYPE_PROMOTION = 103;

    private final KpiCycleMapper kpiCycleMapper;
    private final KpiCategoryMapper kpiCategoryMapper;
    private final KpiMasterMapper kpiMasterMapper;
    private final KpisInformationMapper kpisInformationMapper;
    private final KpiAssignmentMapper kpiAssignmentMapper;
    private final UserMapper userMapper;
    private final KpiScoringRulesService kpiScoringRulesService;

    // ── CREATE ────────────────────────────────────────────────────────────────

    @Transactional
    public StrategicKpiResponse create(CreateStrategicKpiRequest req, UUID actorId, String role) {
        if (req.getEditingKpiInformationId() != null) {
            throw AppException.badRequest(
                    "Updating an existing KPI via this endpoint is not supported; omit editingKpiInformationId.");
        }

        kpiCycleMapper.findById(req.getCycleId())
                .orElseThrow(() -> AppException.notFound("KPI cycle not found: " + req.getCycleId()));

        if (kpiCategoryMapper.countActiveById(req.getPerspective()) < 1) {
            throw AppException.badRequest("Invalid or inactive KPI category (perspective): " + req.getPerspective());
        }

        int type = req.getTypeCode();
        validateTypeCode(type);

        CalcCodes calc = CalcCodes.fromPersisted(req.getCalculationMethod());
        BigDecimal weight = normalizeWeight(req.getWeightPct());
        BigDecimal targetNum = normalizeTargetValue(req.getTargetValue());
        boolean important = Boolean.TRUE.equals(req.getIsImportant());

        List<UUID> assigneeUserIds = resolveAssigneeUserIds(req, type);
        requireExplicitPmTargetsForTeam(req);
        if ((Constant.ROLE_MEMBER.equals(role) || Constant.ROLE_LEADER.equals(role))
                && !assigneeUserIds.contains(actorId)) {
            assigneeUserIds.add(actorId);
        }

        UUID masterId = UUID.randomUUID();
        UUID infoId = UUID.randomUUID();

        kpiMasterMapper.insertKpiMaster(
                masterId,
                truncate(req.getKpiName(), 255),
                req.getPerspective(),
                type,
                calc.ruleCode(),
                calc.typeCode(),
                req.getUnitCode(),
                true,
                actorId);

        String scoringJson = kpiScoringRulesService.serializeForPersistence(req.getTargetDescription());
        kpisInformationMapper.insertKpisInformation(
                infoId,
                req.getCycleId(),
                masterId,
                scoringJson,
                targetNum,
                weight,
                important,
                actorId);

        List<KpiAssignmentInsertRow> rows = new ArrayList<>();
        UUID parentAssignmentId = null;
        if (Constant.ROLE_PM.equals(role)) {
            parentAssignmentId = UUID.randomUUID();
            rows.add(KpiAssignmentInsertRow.builder()
                    .id(parentAssignmentId)
                    .cycleId(req.getCycleId())
                    .kpiInfoId(infoId)
                    .userId(actorId)
                    .jobTitleId(null)
                    .parentAssignmentId(null)
                    .targetValue(targetNum)
                    .statusCode(Constants.AssignStatus.WAITING_GM_APPROVAL)
                    .createdBy(actorId)
                    .build());
        }

        rows.addAll(buildAssignmentRows(
                assigneeUserIds, type, req, infoId, req.getCycleId(), targetNum, actorId, role, parentAssignmentId));

        if (!rows.isEmpty()) {
            kpiAssignmentMapper.insertKpiAssignments(rows);
        }

        GmKpiCategoryResponse cat = kpiCategoryMapper.findActiveById(req.getPerspective()).orElse(null);
        KpiScoringRulesPayload scoringView = kpiScoringRulesService.parseForApi(scoringJson);

        return StrategicKpiResponse.builder()
                .kpiInformationId(infoId)
                .cycleId(req.getCycleId())
                .masterKpiId(masterId)
                .code(null)
                .name(req.getKpiName().trim())
                .categoryId(req.getPerspective())
                .categoryName(cat != null ? cat.getName() : null)
                .typeCode(type)
                .calculationRuleCode(calc.ruleCode())
                .calculationTypeCode(calc.typeCode())
                .unitCode(req.getUnitCode())
                .isGlobal(true)
                .targetDescription(scoringView)
                .targetValue(targetNum)
                .weight(weight)
                .isImportant(important)
                .assignmentsCreated(rows.size())
                .build();
    }

    // ── UPDATE ────────────────────────────────────────────────────────────────

    @Transactional
    public StrategicKpiResponse update(UUID kpiInformationId, CreateStrategicKpiRequest req, UUID actorId,
            String role) {
        KpiStrategicEditMasterRow existing = kpisInformationMapper.selectStrategicKpiEditMaster(kpiInformationId);
        if (existing == null) {
            throw AppException.notFound("KPI information not found: " + kpiInformationId);
        }
        if (!Boolean.TRUE.equals(existing.getIsGlobal())) {
            throw AppException.forbidden("Only global strategic KPIs can be updated.");
        }
        if (!existing.getCycleId().equals(req.getCycleId())) {
            throw AppException.badRequest("cycleId must match the KPI's evaluation cycle.");
        }

        int type = req.getTypeCode();
        boolean typeChanged = existing.getTypeCode() == null || !existing.getTypeCode().equals(type);

        kpiCycleMapper.findById(req.getCycleId())
                .orElseThrow(() -> AppException.notFound("KPI cycle not found: " + req.getCycleId()));

        if (kpiCategoryMapper.countActiveById(req.getPerspective()) < 1) {
            throw AppException.badRequest("Invalid or inactive KPI category (perspective): " + req.getPerspective());
        }
        validateTypeCode(type);

        CalcCodes calc = CalcCodes.fromPersisted(req.getCalculationMethod());
        BigDecimal weight = normalizeWeight(req.getWeightPct());
        BigDecimal targetNum = normalizeTargetValue(req.getTargetValue());
        boolean important = Boolean.TRUE.equals(req.getIsImportant());

        int um = kpiMasterMapper.updateKpiMasterStrategic(
                existing.getMasterKpiId(),
                truncate(req.getKpiName(), 255),
                req.getPerspective(),
                type,
                calc.ruleCode(),
                calc.typeCode(),
                req.getUnitCode(),
                actorId);
        if (um < 1) {
            throw AppException.notFound("kpi_master not found: " + existing.getMasterKpiId());
        }

        String scoringJson = kpiScoringRulesService.serializeForPersistence(req.getTargetDescription());
        kpisInformationMapper.updateKpisInformationStrategic(
                kpiInformationId,
                scoringJson,
                targetNum,
                weight,
                important,
                actorId);

        List<UUID> desired = resolveAssigneeUserIds(req, type);
        requireExplicitPmTargetsForTeam(req);

        if (typeChanged) {
            kpiAssignmentMapper.softDeleteAssignmentsForKpiInformation(
                    kpiInformationId, existing.getCycleId(), actorId);
            List<KpiAssignmentInsertRow> rows = new ArrayList<>();
            UUID parentAssignmentId = null;
            if (Constant.ROLE_PM.equals(role)) {
                parentAssignmentId = UUID.randomUUID();
                rows.add(KpiAssignmentInsertRow.builder()
                        .id(parentAssignmentId)
                        .cycleId(existing.getCycleId())
                        .kpiInfoId(kpiInformationId)
                        .userId(actorId)
                        .jobTitleId(null)
                        .parentAssignmentId(null)
                        .targetValue(targetNum)
                        .statusCode(Constants.AssignStatus.WAITING_GM_APPROVAL)
                        .createdBy(actorId)
                        .build());
            }

            rows.addAll(buildAssignmentRows(
                    desired, type, req, kpiInformationId, existing.getCycleId(), targetNum, actorId, role,
                    parentAssignmentId));

            if (!rows.isEmpty()) {
                kpiAssignmentMapper.insertKpiAssignments(rows);
            }
        } else {
            syncAssignments(kpiInformationId, existing.getCycleId(), desired, type, req, targetNum, actorId, role);
        }

        int assignmentCount = kpiAssignmentMapper.listAssignmentUserTargets(kpiInformationId, existing.getCycleId())
                .size();
        GmKpiCategoryResponse cat = kpiCategoryMapper.findActiveById(req.getPerspective()).orElse(null);
        KpiScoringRulesPayload scoringView = kpiScoringRulesService.parseForApi(scoringJson);

        return StrategicKpiResponse.builder()
                .kpiInformationId(kpiInformationId)
                .cycleId(existing.getCycleId())
                .masterKpiId(existing.getMasterKpiId())
                .code(null)
                .name(req.getKpiName().trim())
                .categoryId(req.getPerspective())
                .categoryName(cat != null ? cat.getName() : null)
                .typeCode(type)
                .calculationRuleCode(calc.ruleCode())
                .calculationTypeCode(calc.typeCode())
                .unitCode(req.getUnitCode())
                .isGlobal(true)
                .targetDescription(scoringView)
                .targetValue(targetNum)
                .weight(weight)
                .isImportant(important)
                .assignmentsCreated(assignmentCount)
                .build();
    }

    // ── GET FOR EDIT ──────────────────────────────────────────────────────────

    /**
     * @param parentAssignmentId khi PM mở drawer phân bổ: chỉ trả
     *                           {@code memberIds}/{@code memberTargets}
     *                           cho assignment con của đúng dòng PM (không lẫn PM
     *                           khác do GM giao).
     */
    public StrategicKpiEditResponse getForEdit(
            UUID kpiInformationId, UUID actorId, UUID parentAssignmentId) {
        KpiStrategicEditMasterRow row = kpisInformationMapper.selectStrategicKpiEditMaster(kpiInformationId);
        if (row == null) {
            throw AppException.notFound("KPI information not found: " + kpiInformationId);
        }
        if (!Boolean.TRUE.equals(row.getIsGlobal())) {
            throw AppException.forbidden("Only global strategic KPIs can be viewed for edit.");
        }

        List<KpiAssignmentUserTargetRow> assigns;
        if (parentAssignmentId != null) {
            int owned = kpiAssignmentMapper.countAssignmentOwnedByUserForKpiInfo(
                    parentAssignmentId, actorId, kpiInformationId);
            if (owned < 1) {
                throw AppException.forbidden(
                        "Parent assignment is invalid, not owned by you, or does not match this KPI.");
            }
            assigns = kpiAssignmentMapper.listChildAssignmentsByParentId(parentAssignmentId);
        } else {
            assigns = kpiAssignmentMapper.listAssignmentUserTargets(kpiInformationId, row.getCycleId());
        }

        String calcMethod = StrategicKpiCalcMapper.fromDb(row.getCalculationTypeCode(), row.getCalculationRuleCode());

        KpiScoringRulesPayload scoringPayload = kpiScoringRulesService.parseForApi(row.getTargetDescription());

        StrategicKpiEditResponse.StrategicKpiEditResponseBuilder b = StrategicKpiEditResponse.builder()
                .kpiInformationId(row.getKpiInformationId())
                .cycleId(row.getCycleId())
                .masterKpiId(row.getMasterKpiId())
                .typeCode(row.getTypeCode())
                .perspective(row.getCategoryId())
                .kpiName(row.getKpiName())
                .targetDescription(scoringPayload)
                .targetValue(row.getTargetValue())
                .unitCode(row.getUnitCode())
                .weightPct(row.getWeight())
                .calculationMethod(calcMethod)
                .isImportant(Boolean.TRUE.equals(row.getIsImportant()));

        // TEAM: danh sách PM do GM giao — chỉ khi xem full KPI (không lọc theo parent
        // PM).
        if (row.getTypeCode() != null
                && row.getTypeCode() == TYPE_TEAM
                && parentAssignmentId == null) {
            LinkedHashSet<UUID> pmOrder = new LinkedHashSet<>();
            Map<String, Object> pmTargets = new LinkedHashMap<>();
            for (KpiAssignmentUserTargetRow a : assigns) {
                if (a.getUserId() != null) {
                    pmOrder.add(a.getUserId());
                    if (a.getTargetValue() != null) {
                        pmTargets.put(a.getUserId().toString(), a.getTargetValue());
                    }
                }
            }
            b.assignPMs(new ArrayList<>(pmOrder)).pmTargets(pmTargets);
        }

        List<UUID> memberIds = assigns.stream()
                .map(KpiAssignmentUserTargetRow::getUserId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<String, Object> memberTargets = assigns.stream()
                .filter(targetRow -> targetRow.getUserId() != null)
                .filter(targetRow -> targetRow.getTargetValue() != null)
                .collect(Collectors.toMap(
                        targetRow -> targetRow.getUserId().toString(),
                        KpiAssignmentUserTargetRow::getTargetValue,
                        (existing, replacement) -> existing));
        b.memberIds(memberIds);
        b.memberTargets(memberTargets);

        return b.build();
    }

    // ── DELETE ────────────────────────────────────────────────────────────────

    @Transactional
    public void deleteByKpiInformationId(UUID kpiInformationId, UUID actorId) {
        KpiInfoForDeleteRow row = kpisInformationMapper.selectKpiInfoForDelete(kpiInformationId);
        if (row == null) {
            throw AppException.notFound("KPI information not found or already deleted: " + kpiInformationId);
        }
        if (!Boolean.TRUE.equals(row.getIsGlobal())) {
            throw AppException.forbidden(
                    "Only company-level (is_global) strategic KPIs can be deleted via this endpoint.");
        }

        kpiAssignmentMapper.softDeleteAssignmentsForKpiInformation(kpiInformationId, row.getCycleId(), actorId);
        int updatedInfo = kpisInformationMapper.softDeleteKpisInformationById(kpiInformationId, actorId);
        if (updatedInfo < 1) {
            throw AppException.notFound("KPI information not found or already deleted: " + kpiInformationId);
        }

        int remaining = kpisInformationMapper.countActiveKpisInformationByMasterKpiId(row.getMasterKpiId());
        if (remaining == 0) {
            kpiMasterMapper.softDeleteKpiMasterById(row.getMasterKpiId(), actorId);
        }
    }

    // ── PRIVATE HELPERS ───────────────────────────────────────────────────────

    private void syncAssignments(UUID kpiInfoId, UUID cycleId, List<UUID> desired,
            int type, CreateStrategicKpiRequest req,
            BigDecimal targetNum, UUID actorId, String role) {
        List<KpiAssignmentUserTargetRow> currentRows = kpiAssignmentMapper.listAssignmentUserTargets(kpiInfoId,
                cycleId);

        Map<UUID, UUID> assignmentIdByUser = currentRows.stream()
                .filter(r -> r.getUserId() != null)
                .collect(Collectors.toMap(
                        KpiAssignmentUserTargetRow::getUserId, KpiAssignmentUserTargetRow::getId, (a, b) -> a));

        LinkedHashSet<UUID> desiredSet = new LinkedHashSet<>(desired);

        for (KpiAssignmentUserTargetRow row : currentRows) {
            if (row.getUserId() == null)
                continue;
            // Never delete the PM's parent assignment here
            if (Constant.ROLE_PM.equals(role) && actorId.equals(row.getUserId())
                    && row.getParentAssignmentId() == null) {
                continue;
            }
            if (!desiredSet.contains(row.getUserId())) {
                kpiAssignmentMapper.softDeleteKpiAssignmentById(row.getId(), cycleId, actorId);
            }
        }

        for (UUID uid : desired) {
            // Update child assignments
            BigDecimal rowTarget = teamTarget(type, uid, req, targetNum);
            UUID aid = assignmentIdByUser.get(uid);
            if (aid != null) {
                kpiAssignmentMapper.updateKpiAssignmentTarget(aid, cycleId, rowTarget, actorId);
            }
        }

        // Ensure PM's parent assignment target is updated
        if (Constant.ROLE_PM.equals(role)) {
            UUID aid = assignmentIdByUser.get(actorId);
            if (aid != null) {
                kpiAssignmentMapper.updateKpiAssignmentTarget(aid, cycleId, targetNum, actorId);
            }
        }

        UUID parentAssignmentId = null;
        if (Constant.ROLE_PM.equals(role)) {
            // Find existing parent assignment for the PM
            parentAssignmentId = currentRows.stream()
                    .filter(r -> actorId.equals(r.getUserId()) && r.getParentAssignmentId() == null)
                    .map(KpiAssignmentUserTargetRow::getId)
                    .findFirst()
                    .orElse(null);

            if (parentAssignmentId == null) {
                // If it doesn't exist, create it
                parentAssignmentId = UUID.randomUUID();
                List<KpiAssignmentInsertRow> pmRow = new ArrayList<>();
                pmRow.add(KpiAssignmentInsertRow.builder()
                        .id(parentAssignmentId)
                        .cycleId(cycleId)
                        .kpiInfoId(kpiInfoId)
                        .userId(actorId)
                        .jobTitleId(null)
                        .parentAssignmentId(null)
                        .targetValue(targetNum)
                        .statusCode(Constants.AssignStatus.WAITING_GM_APPROVAL)
                        .createdBy(actorId)
                        .build());
                kpiAssignmentMapper.insertKpiAssignments(pmRow);
            }
        }

        List<UUID> newIds = desired.stream().filter(uid -> !assignmentIdByUser.containsKey(uid)).toList();
        List<KpiAssignmentInsertRow> newRows = buildAssignmentRows(newIds, type, req, kpiInfoId, cycleId, targetNum,
                actorId, role, parentAssignmentId);
        if (!newRows.isEmpty()) {
            kpiAssignmentMapper.insertKpiAssignments(newRows);
        }
    }

    private List<KpiAssignmentInsertRow> buildAssignmentRows(
            List<UUID> userIds, int type, CreateStrategicKpiRequest req,
            UUID kpiInfoId, UUID cycleId, BigDecimal targetNum, UUID actorId, String role, UUID parentAssignmentId) {
        if (userIds.isEmpty())
            return new ArrayList<>();
        int initialStatus = initialAssignmentStatusForStrategicCreate(type, role);
        if (Constant.ROLE_PM.equals(role)) {
            initialStatus = Constants.AssignStatus.WAITING_GM_APPROVAL;
        }
        Map<UUID, UUID> jobByUser = loadJobTitleByUserId(userIds);
        List<KpiAssignmentInsertRow> rows = new ArrayList<>();
        for (UUID uid : userIds) {
            rows.add(KpiAssignmentInsertRow.builder()
                    .id(UUID.randomUUID())
                    .cycleId(cycleId)
                    .kpiInfoId(kpiInfoId)
                    .userId(uid)
                    .jobTitleId(jobByUser.get(uid))
                    .parentAssignmentId(parentAssignmentId)
                    .targetValue(teamTarget(type, uid, req, targetNum))
                    .statusCode(initialStatus)
                    .createdBy(actorId)
                    .build());
        }
        return rows;
    }

    /**
     * Member/Leader + KPI individual: chờ PM duyệt (402).
     * PM tạo qua strategic-kpis: chờ GM duyệt (403).
     * GM và các role khác: chờ chấp nhận mục tiêu (404).
     */
    private static int initialAssignmentStatusForStrategicCreate(int type, String role) {
        if ((Constant.ROLE_MEMBER.equals(role) || Constant.ROLE_LEADER.equals(role))
                && type == TYPE_INDIVIDUAL) {
            return Constants.AssignStatus.PENDING_ACCEPTANCE;
        }
        if (Constant.ROLE_PM.equals(role)) {
            return Constants.AssignStatus.WAITING_GM_APPROVAL;
        }
        return Constants.AssignStatus.PENDING_ACCEPTANCE;
    }

    /**
     * TEAM KPI: nếu đã chọn PM ({@code assignPMs}) thì bắt buộc nhập mục tiêu từng
     * người trong {@code pmTargets}
     * — không fallback sang {@code targetValue} của KPI cha (tránh gán nhầm cùng
     * một số cho mọi PM).
     */
    private static void requireExplicitPmTargetsForTeam(CreateStrategicKpiRequest req) {
        if (req.getTypeCode() != TYPE_TEAM) {
            return;
        }
        List<UUID> assign = req.getAssignPMs();
        if (assign == null || assign.isEmpty()) {
            return;
        }
        Map<String, Object> pm = req.getPmTargets();
        for (UUID uid : assign) {
            Object raw = lookupPmTargetRaw(pm, uid);
            if (raw == null) {
                throw AppException.badRequest(
                        "Team KPI: thiếu mục tiêu cho PM đã chọn");
            }
            String s = String.valueOf(raw).trim();
            if (s.isEmpty()) {
                throw AppException.badRequest(
                        "Team KPI: Target value không được để trống cho PM");
            }
            try {
                BigDecimal val = normalizeTargetValue(new BigDecimal(s));
                if (val.compareTo(BigDecimal.ZERO) < 0) {
                    throw AppException.badRequest(
                            "Team KPI: mục tiêu PM phải ≥ 0");
                }
            } catch (NumberFormatException ex) {
                throw AppException.badRequest("pmTargets has invalid number for user " + uid + ": " + s);
            }
        }
    }

    private static Object lookupPmTargetRaw(Map<String, Object> pm, UUID userId) {
        if (pm == null || pm.isEmpty()) {
            return null;
        }
        String canonical = userId.toString();
        Object raw = pm.get(canonical);
        if (raw == null) {
            for (Map.Entry<String, Object> e : pm.entrySet()) {
                String k = e.getKey();
                if (k != null && canonical.equalsIgnoreCase(k.trim())) {
                    raw = e.getValue();
                    break;
                }
            }
        }
        return raw;
    }

    private static BigDecimal teamTarget(int type, UUID userId, CreateStrategicKpiRequest req, BigDecimal fallback) {
        if (type != TYPE_TEAM)
            return fallback;
        Map<String, Object> pm = req.getPmTargets();
        if (pm == null || pm.isEmpty())
            return fallback;
        Object raw = lookupPmTargetRaw(pm, userId);
        if (raw == null)
            return fallback;
        if (raw instanceof BigDecimal bd)
            return normalizeTargetValue(bd);
        if (raw instanceof Number n)
            return normalizeTargetValue(BigDecimal.valueOf(n.doubleValue()));
        String s = String.valueOf(raw).trim();
        if (s.isEmpty())
            return fallback;
        try {
            return normalizeTargetValue(new BigDecimal(s));
        } catch (NumberFormatException ex) {
            throw AppException.badRequest("pmTargets has invalid number for user " + userId + ": " + s);
        }
    }

    private List<UUID> resolveAssigneeUserIds(CreateStrategicKpiRequest req, int type) {
        List<UUID> ids = (type == TYPE_TEAM) ? req.getAssignPMs() : req.getMemberIds();
        if (ids == null || ids.isEmpty())
            return new ArrayList<>();
        List<UUID> distinct = new ArrayList<>(new LinkedHashSet<>(ids));
        List<UUID> existing = userMapper.listExistingActiveUserIds(distinct);
        if (existing.size() != distinct.size()) {
            throw AppException.badRequest(type == TYPE_TEAM
                    ? "One or more assignPMs are invalid or inactive."
                    : "One or more memberIds are invalid or inactive.");
        }
        return distinct;
    }

    private Map<UUID, UUID> loadJobTitleByUserId(List<UUID> userIds) {
        return userMapper.listUserJobTitlesByIds(userIds).stream()
                .collect(Collectors.toMap(UserJobTitlePair::getUserId, UserJobTitlePair::getJobTitleId, (a, b) -> a));
    }

    private static void validateTypeCode(int type) {
        if (type != TYPE_INDIVIDUAL && type != TYPE_TEAM && type != TYPE_PROMOTION) {
            throw AppException
                    .badRequest("typeCode must be 101 (individual), 102 (team/cascading), or 103 (promotion).");
        }
    }

    // private static String nullableTrim(String s) {
    // if (s == null)
    // return null;
    // String t = s.trim();
    // return t.isEmpty() ? null : t;
    // }

    private static String truncate(String s, int max) {
        String t = s.trim();
        return t.length() <= max ? t : t.substring(0, max);
    }

    private static BigDecimal normalizeWeight(BigDecimal raw) {
        if (raw == null)
            throw AppException.badRequest("weightPct is required.");
        BigDecimal w = raw.setScale(2, RoundingMode.HALF_UP);
        if (w.compareTo(BigDecimal.ZERO) <= 0 || w.compareTo(new BigDecimal("1000")) > 0) {
            throw AppException.badRequest("weightPct must be between 0 and 1000.");
        }
        return w;
    }

    private static BigDecimal normalizeTargetValue(BigDecimal raw) {
        return raw == null ? null : raw.setScale(4, RoundingMode.HALF_UP);
    }

    /**
     * DB code (ruleCode, typeCode) → persisted string — đồng bộ kpi-fe
     * kpiCalculationCodes.ts.
     */
    static final class StrategicKpiCalcMapper {
        private StrategicKpiCalcMapper() {
        }

        static String fromDb(Integer typeCode, Integer ruleCode) {
            int rule = ruleCode != null ? ruleCode : 802;
            if (rule == 801)
                return "mean_plan_actual_sum";
            if (rule == 803)
                return "manual_member_input";
            if (rule == 802) {
                if (typeCode != null && typeCode == 702)
                    return "mean_plan_actual";
                if (typeCode != null && typeCode == 701)
                    return "mean_actual_plan";
                return "mean_plan_actual_pct";
            }
            return "mean_actual_plan";
        }

        static CalcCodes fromPersisted(String persisted) {
            String k = persisted == null ? "" : persisted.trim();
            return switch (k) {
                case "manual_member_input" -> new CalcCodes(803, null);
                case "mean_actual_plan" -> new CalcCodes(802, 701);
                case "mean_plan_actual" -> new CalcCodes(802, 702);
                case "mean_plan_actual_pct" -> new CalcCodes(802, 701);
                case "mean_plan_actual_sum" -> new CalcCodes(801, null);
                default -> new CalcCodes(802, 701);
            };
        }
    }

    private record CalcCodes(int ruleCode, Integer typeCode) {
        static CalcCodes fromPersisted(String p) {
            return StrategicKpiCalcMapper.fromPersisted(p);
        }
    }

    @Transactional
    public void assignToMembers(AssignMemberRequest req, UUID userId) {
        Map<UUID, BigDecimal> requestedTargets = req.getMemberTargets() == null
                ? new LinkedHashMap<>()
                : new LinkedHashMap<>(req.getMemberTargets());
        KpiAssignmentUserTargetRow parentAssignment = null;

        if (req.getParentAssignmentId() != null) {
            int owned = kpiAssignmentMapper.countAssignmentOwnedByUserForKpiInfo(
                    req.getParentAssignmentId(), userId, req.getKpiInformationId());
            if (owned < 1) {
                throw AppException.forbidden(
                        "Parent assignment is invalid, not owned by you, or does not match this KPI.");
            }

            parentAssignment = kpiAssignmentMapper.findAssignmentUserTargetByIdAndCycle(
                    req.getParentAssignmentId(), req.getCycleId());
            if (parentAssignment == null || parentAssignment.getUserId() == null) {
                throw AppException.badRequest("Parent assignment not found in this cycle.");
            }

            // Phần target chưa phân không tự gán cho PM khi lưu — chỉ khi PM có trong
            // payload (vd. bấm «Assign to me» trên FE).

            // Đồng bộ danh sách: gỡ cascade cũ rồi tạo lại (PM bỏ chọn member → không còn
            // bản ghi / không insert trùng).
            kpiAssignmentMapper.softDeleteChildAssignmentsByParentAndCycle(
                    req.getParentAssignmentId(), req.getCycleId(), userId);
        }

        if (requestedTargets.isEmpty()) {
            // Cho phép PM lưu phân bổ rỗng: nếu có parentAssignmentId thì các assignment
            // con cũ đã được soft-delete ở trên.
            return;
        }

        List<UUID> assigneeUserIds = new ArrayList<>(requestedTargets.keySet());

        List<UUID> existingActiveUserIds = userMapper.listExistingActiveUserIds(assigneeUserIds);
        if (existingActiveUserIds.size() != assigneeUserIds.size()) {
            throw AppException.badRequest("One or more assignees are invalid or inactive.");
        }

        // 2. Lấy thông tin chức danh (Job Title) của các nhân viên được giao
        Map<UUID, UUID> jobByUser = userMapper.listUserJobTitlesByIds(assigneeUserIds).stream()
                .collect(Collectors.toMap(UserJobTitlePair::getUserId, UserJobTitlePair::getJobTitleId, (a, b) -> a));

        List<KpiAssignment> rowsToInsert = new ArrayList<>();

        // 3. Build data insert cho từng member
        for (Map.Entry<UUID, BigDecimal> entry : requestedTargets.entrySet()) {
            UUID memberId = entry.getKey();
            BigDecimal targetValue = normalizeTargetValue(entry.getValue());
            int statusCode = Constants.AssignStatus.PENDING_ACCEPTANCE;
            if (parentAssignment != null
                    && parentAssignment.getUserId() != null
                    && parentAssignment.getUserId().equals(memberId)) {
                // PM tự nhận phần target còn lại phải giữ trạng thái hiện tại của assignment
                // cha (thường là 405).
                statusCode = parentAssignment.getStatusCode() != null
                        ? parentAssignment.getStatusCode()
                        : Constants.AssignStatus.ACCEPTED;
            }

            KpiAssignment assignment = new KpiAssignment();
            assignment.setId(UUID.randomUUID());
            assignment.setCycleId(req.getCycleId());
            assignment.setKpiInfoId(req.getKpiInformationId());
            assignment.setUserId(memberId);
            assignment.setJobTitleId(jobByUser.get(memberId));
            assignment.setParentAssignmentId(req.getParentAssignmentId());
            assignment.setTargetValue(targetValue);
            assignment.setStatusCode(statusCode);
            assignment.setCreatedBy(userId);

            rowsToInsert.add(assignment);
        }

        // 4. Batch Insert vào Database
        if (!rowsToInsert.isEmpty()) {
            kpiAssignmentMapper.insertKpiAssignmentsWithEntity(rowsToInsert);
        }
    }

    @Transactional
    public int updateStatusesKpi(UpdateKpiStatusRequest request, UUID currentUserId) {

        if (!Boolean.TRUE.equals(request.getBulkForManagedMembers())
                && request.getOnlyFromStatusCode() != null
                && request.getOnlyFromStatusCode() == Constants.AssignStatus.PENDING_ACCEPTANCE
                && request.getStatusCode() != null
                && request.getStatusCode() == Constants.AssignStatus.ACCEPTED
                && !request.isPromotion()
                && kpiAssignmentMapper.existsTeamCascadeBlockingPmAccept(currentUserId, request.getCycleId())) {
            throw AppException.badRequest(
                    "Vui lòng phân bổ ít nhất một thành viên cho mỗi KPI Team và chờ họ xác nhận trước khi chấp nhận KPI.");
        }

        int updatedCount;
        if (Boolean.TRUE.equals(request.getBulkForManagedMembers())) {
            // Team Review: assignment thuộc member/leader dưới PM — không dùng ka.user_id =
            // PM.
            updatedCount = kpiAssignmentMapper.updateKpiStatusesForPmManagedMembers(
                    currentUserId,
                    request.getCycleId(),
                    request.getStatusCode(),
                    false,
                    request.getOnlyFromStatusCode());
            updatedCount += kpiAssignmentMapper.updateKpiStatusesForPmManagedMembers(
                    currentUserId,
                    request.getCycleId(),
                    request.getStatusCode(),
                    true,
                    request.getOnlyFromStatusCode());

            // Team KPI của chính PM không nằm trong cây managed members.
            // Đồng bộ parent Team assignment lên 502/602 để GM Evaluation Hub nhìn thấy
            // dòng PM.
            Integer nextStatus = request.getStatusCode();
            if (request.isPromotion() == false && nextStatus != null && (nextStatus == 502 || nextStatus == 602)) {
                updatedCount += kpiAssignmentMapper.syncPmTeamParentStatusesFromManagedChildren(
                        currentUserId,
                        request.getCycleId(),
                        nextStatus,
                        currentUserId);
            }
        } else {
            updatedCount = kpiAssignmentMapper.updateKpiStatuses(
                    currentUserId,
                    request.getCycleId(),
                    request.getStatusCode(),
                    request.isPromotion(),
                    request.getOnlyFromStatusCode());
        }

        if (updatedCount == 0) {
            throw AppException.badRequest("Don't find KPI to update.");
        }

        return updatedCount;
    }
}
