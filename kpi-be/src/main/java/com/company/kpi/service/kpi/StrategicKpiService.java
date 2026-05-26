package com.company.kpi.service.kpi;

import com.company.kpi.aggregate.KpiAssignmentInsertRow;
import com.company.kpi.aggregate.KpiAssignmentUserTargetRow;
import com.company.kpi.aggregate.KpiInfoForDeleteRow;
import com.company.kpi.aggregate.KpiStrategicEditMasterRow;
import com.company.kpi.aggregate.UserJobTitlePair;
import com.company.kpi.common.constant.Constant;
import com.company.kpi.common.Constants;
import com.company.kpi.common.exception.AppException;
import com.company.kpi.util.MemberAssignmentEligibility;
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
import java.time.LocalDate;
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
    private final UserKpiSummaryMapper userKpiSummaryMapper;
    private final KpiScoringRulesService kpiScoringRulesService;
    private final KpiAssignmentSnapshotService kpiAssignmentSnapshotService;
    private final MemberAssignmentEligibilityService memberAssignmentEligibilityService;
    private final PromotionAssignmentValidationService promotionAssignmentValidationService;

    // ── CREATE ────────────────────────────────────────────────────────────────

    @Transactional
    public StrategicKpiResponse create(CreateStrategicKpiRequest req, UUID actorId, String role) {
        if (req.getEditingKpiInformationId() != null) {
            throw AppException.badRequest(
                    "Updating an existing KPI via this endpoint is not supported; omit editingKpiInformationId.");
        }

        UUID cycleId = resolveCreateCycleId(req.getCycleId());
        req.setCycleId(cycleId);

        if (kpiCategoryMapper.countActiveById(req.getPerspective()) < 1) {
            throw AppException.badRequest("Invalid or inactive KPI category (perspective): " + req.getPerspective());
        }

        int type = req.getTypeCode();
        validateTypeCode(type);

        CalcCodes calc = CalcCodes.fromPersisted(req.getCalculationMethod());
        BigDecimal weight = normalizeWeight(req.getWeightPct());
        BigDecimal targetNum = normalizeTargetValue(req.getTargetValue());
        requirePositiveCatalogTargetIfPresent(targetNum);
        boolean important = Boolean.TRUE.equals(req.getIsImportant());
        boolean allowAssigneeEdit = Boolean.TRUE.equals(req.getAllowAssigneeTargetScaleEdit());

        List<UUID> assigneeUserIds = resolveAssigneeUserIds(req, type);
        requireExplicitPmTargetsForTeam(req);
        assertMemberAssigneesEligibleForPmGmCreate(cycleId, type, assigneeUserIds, role);
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
                cycleId,
                masterId,
                scoringJson,
                targetNum,
                weight,
                important,
                allowAssigneeEdit,
                actorId);

        List<KpiAssignmentInsertRow> rows = new ArrayList<>();
        UUID parentAssignmentId = null;
        if (Constant.ROLE_PM.equals(role)) {
            parentAssignmentId = UUID.randomUUID();
            rows.add(KpiAssignmentInsertRow.builder()
                    .id(parentAssignmentId)
                    .cycleId(cycleId)
                    .kpiInfoId(infoId)
                    .userId(actorId)
                    .jobTitleId(null)
                    .parentAssignmentId(null)
                    .targetValue(targetNum)
                    .scoringScale(resolveScoringScaleForInsert(null, cycleId, scoringJson))
                    .statusCode(Constants.AssignStatus.PENDING_ACCEPTANCE)
                    .createdBy(actorId)
                    .promotionCycleId(type == TYPE_PROMOTION ? req.getPromotionCycleId() : null)
                    .build());
        }

        rows.addAll(buildAssignmentRows(
                assigneeUserIds, type, req, infoId, cycleId, targetNum, actorId, role, parentAssignmentId,
                scoringJson));

        promotionAssignmentValidationService.assertValidPromotionAssignmentsForInsertRows(
                type,
                rows.stream()
                        .map(r -> new PromotionAssignmentValidationService.PromotionAssignmentInsert(
                                r.getUserId(), null, r.getPromotionCycleId()))
                        .toList());

        if (!rows.isEmpty()) {
            kpiAssignmentMapper.insertKpiAssignments(rows);
            kpiAssignmentSnapshotService.createSnapshotsForInsertRows(rows, actorId);
        }

        GmKpiCategoryResponse cat = kpiCategoryMapper.findActiveById(req.getPerspective()).orElse(null);
        KpiScoringRulesPayload scoringView = kpiScoringRulesService.parseForApi(scoringJson);

        return StrategicKpiResponse.builder()
                .kpiInformationId(infoId)
                .cycleId(cycleId)
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
                .allowAssigneeTargetScaleEdit(allowAssigneeEdit)
                .assignmentsCreated(rows.size())
                .build();
    }

    private UUID resolveCreateCycleId(UUID requestedCycleId) {
        if (requestedCycleId != null) {
            kpiCycleMapper.findById(requestedCycleId)
                    .orElseThrow(() -> AppException.notFound("KPI cycle not found: " + requestedCycleId));
            return requestedCycleId;
        }

        int currentYear = LocalDate.now().getYear();
        return kpiCycleMapper.findByYear(currentYear)
                .orElseThrow(() -> AppException.notFound("KPI cycle not found for current year: " + currentYear))
                .getId();
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
        boolean preserveAssignmentsOnGmEdit = shouldPreserveAssignmentsOnGmEdit(role, existing.getCreatorRoleCode());

        if (typeChanged && preserveAssignmentsOnGmEdit) {
            throw AppException.badRequest(
                    "Cannot change KPI assignment type for KPIs created by PM, Leader, or Member.");
        }

        kpiCycleMapper.findById(req.getCycleId())
                .orElseThrow(() -> AppException.notFound("KPI cycle not found: " + req.getCycleId()));

        if (kpiCategoryMapper.countActiveById(req.getPerspective()) < 1) {
            throw AppException.badRequest("Invalid or inactive KPI category (perspective): " + req.getPerspective());
        }
        validateTypeCode(type);

        CalcCodes calc = CalcCodes.fromPersisted(req.getCalculationMethod());
        BigDecimal weight = normalizeWeight(req.getWeightPct());
        BigDecimal targetNum = normalizeTargetValue(req.getTargetValue());
        requirePositiveCatalogTargetIfPresent(targetNum);
        boolean important = Boolean.TRUE.equals(req.getIsImportant());
        boolean allowAssigneeEdit = Boolean.TRUE.equals(req.getAllowAssigneeTargetScaleEdit());

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
                allowAssigneeEdit,
                actorId);

        if (catalogScoringChanged(existing.getTargetDescription(), scoringJson)) {
            propagateCatalogScoringToAssignments(
                    kpiInformationId, existing.getCycleId(), scoringJson, actorId);
        }

        List<UUID> desired = resolveAssigneeUserIds(req, type);
        requireExplicitPmTargetsForTeam(req);

        if (!preserveAssignmentsOnGmEdit) {
            assertMemberAssigneesEligibleForPmGmUpdate(
                    existing.getCycleId(), kpiInformationId, type, desired, role);
        }

        if (preserveAssignmentsOnGmEdit
                && catalogTargetChanged(existing.getTargetValue(), targetNum)) {
            int propagatedRows = propagateCatalogTargetToMatchingAssignments(
                    kpiInformationId, existing.getCycleId(), existing.getTargetValue(), targetNum, actorId);
            if (propagatedRows == 0 && targetNum != null) {
                int rootCount = kpiAssignmentMapper.countRootAssignmentsForKpi(
                        kpiInformationId, existing.getCycleId());
                if (rootCount <= 1) {
                    kpiAssignmentMapper.updateRootAssignmentTargetsToCatalog(
                            kpiInformationId, existing.getCycleId(), targetNum, actorId);
                }
            }
        }

        if (!preserveAssignmentsOnGmEdit) {
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
                            .scoringScale(resolveScoringScaleForInsert(
                                    null, existing.getCycleId(), scoringJson))
                            .statusCode(Constants.AssignStatus.PENDING_ACCEPTANCE)
                            .createdBy(actorId)
                            .promotionCycleId(type == TYPE_PROMOTION ? req.getPromotionCycleId() : null)
                            .build());
                }

                rows.addAll(buildAssignmentRows(
                        desired, type, req, kpiInformationId, existing.getCycleId(), targetNum, actorId, role,
                        parentAssignmentId, scoringJson));

                promotionAssignmentValidationService.assertValidPromotionAssignmentsForInsertRows(
                        type,
                        rows.stream()
                                .map(r -> new PromotionAssignmentValidationService.PromotionAssignmentInsert(
                                        r.getUserId(), null, r.getPromotionCycleId()))
                                .toList());

                if (!rows.isEmpty()) {
                    kpiAssignmentMapper.insertKpiAssignments(rows);
                    kpiAssignmentSnapshotService.createSnapshotsForInsertRows(rows, actorId);
                }
            } else {
                syncAssignments(kpiInformationId, existing.getCycleId(), desired, type, req, targetNum, actorId, role);
            }
        }

        if (Constant.ROLE_PM.equals(role)) {
            kpiAssignmentMapper.resubmitRejectedSelfCreatedAssignments(
                    kpiInformationId,
                    existing.getCycleId(),
                    actorId,
                    Constants.AssignStatus.REJECTED,
                    Constants.AssignStatus.PENDING_ACCEPTANCE);
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
                .allowAssigneeTargetScaleEdit(allowAssigneeEdit)
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
                .isImportant(Boolean.TRUE.equals(row.getIsImportant()))
                .allowAssigneeTargetScaleEdit(Boolean.TRUE.equals(row.getAllowAssigneeTargetScaleEdit()))
                .creatorRoleCode(trimUpperOrNull(row.getCreatorRoleCode()));

        // TEAM: danh sách PM do GM giao — chỉ khi xem full KPI (không lọc theo parent
        // PM). Chỉ lấy assignment gốc (parent_assignment_id null): tránh dòng con PM tự
        // assign cùng user_id ghi đè target GM→PM trong drawer edit.
        if (row.getTypeCode() != null
                && row.getTypeCode() == TYPE_TEAM
                && parentAssignmentId == null) {
            LinkedHashSet<UUID> pmOrder = new LinkedHashSet<>();
            Map<String, Object> pmTargets = new LinkedHashMap<>();
            for (KpiAssignmentUserTargetRow a : assigns) {
                if (a.getParentAssignmentId() != null) {
                    continue;
                }
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

    /**
     * GM sửa KPI do PM/Leader/Member tạo: chỉ cập nhật master/info, không đồng bộ assignment
     * (drawer không gửi {@code assignPMs}/{@code memberIds} — tránh sync với danh sách rỗng xóa hết phân bổ).
     */
    private static boolean shouldPreserveAssignmentsOnGmEdit(String actorRole, String creatorRoleCode) {
        if (Constant.ROLE_PM.equals(actorRole)
                || Constant.ROLE_MEMBER.equals(actorRole)
                || Constant.ROLE_LEADER.equals(actorRole)) {
            return false;
        }
        String creator = trimUpperOrNull(creatorRoleCode);
        if (creator == null) {
            return Constant.ROLE_GM.equals(actorRole);
        }
        return !"GM".equals(creator);
    }

    private static String trimUpperOrNull(String value) {
        if (value == null) {
            return null;
        }
        String t = value.trim();
        return t.isEmpty() ? null : t.toUpperCase();
    }

    private static boolean catalogTargetChanged(BigDecimal before, BigDecimal after) {
        if (before == null && after == null) {
            return false;
        }
        if (before == null || after == null) {
            return true;
        }
        return before.compareTo(after) != 0;
    }

    /**
     * PM/Leader/Member UI ưu tiên {@code kpi_assignments.target_value}; đồng bộ các dòng còn target catalog cũ.
     */
    private int propagateCatalogTargetToMatchingAssignments(
            UUID kpiInfoId,
            UUID cycleId,
            BigDecimal oldCatalogTarget,
            BigDecimal newCatalogTarget,
            UUID actorId) {
        return kpiAssignmentMapper.updateAssignmentTargetsMatchingCatalog(
                kpiInfoId, cycleId, oldCatalogTarget, newCatalogTarget, actorId);
    }

    /** GM sửa thang điểm catalog: đồng bộ xuống assignment chưa có baseline chỉnh tay. */
    private int propagateCatalogScoringToAssignments(
            UUID kpiInfoId, UUID cycleId, String catalogScoringJson, UUID actorId) {
        if (catalogScoringJson == null || catalogScoringJson.isBlank()) {
            return 0;
        }
        return kpiAssignmentMapper.updateAssignmentScoringWithoutAssigneeBaseline(
                kpiInfoId, cycleId, catalogScoringJson, actorId);
    }

    private static boolean catalogScoringChanged(String before, String after) {
        if (before == null && after == null) {
            return false;
        }
        if (before == null || after == null) {
            return true;
        }
        return !before.trim().equals(after.trim());
    }

    /**
     * Team KPI: {@code desired} chỉ chứa PM (assignPMs). Member cascade có
     * {@code parent_assignment_id} trỏ tới bản ghi PM — không nằm trong {@code desired}
     * nhưng phải giữ khi PM đó vẫn được giao. Khi gỡ PM khỏi danh sách, xóa luôn các
     * dòng con (member) thuộc PM đó.
     */
    private static boolean shouldSoftDeleteStrategicAssignmentRow(
            KpiAssignmentUserTargetRow row,
            LinkedHashSet<UUID> desiredSet,
            int type,
            String role,
            UUID actorId,
            Map<UUID, KpiAssignmentUserTargetRow> rowsByAssignmentId) {
        if (row.getUserId() == null) {
            return false;
        }
        if (Constant.ROLE_PM.equals(role) && actorId.equals(row.getUserId())
                && row.getParentAssignmentId() == null) {
            return false;
        }
        if (type == TYPE_TEAM && row.getParentAssignmentId() != null) {
            if (Constant.ROLE_PM.equals(role)) {
                return !desiredSet.contains(row.getUserId());
            }
            KpiAssignmentUserTargetRow parent = rowsByAssignmentId.get(row.getParentAssignmentId());
            UUID parentPmUserId = parent != null ? parent.getUserId() : null;
            if (parentPmUserId != null && desiredSet.contains(parentPmUserId)) {
                return false;
            }
            return true;
        }
        return !desiredSet.contains(row.getUserId());
    }

    private void syncAssignments(UUID kpiInfoId, UUID cycleId, List<UUID> desired,
            int type, CreateStrategicKpiRequest req,
            BigDecimal targetNum, UUID actorId, String role) {
        List<KpiAssignmentUserTargetRow> currentRows = kpiAssignmentMapper.listAssignmentUserTargets(kpiInfoId,
                cycleId);

        Map<UUID, KpiAssignmentUserTargetRow> rowsByAssignmentId = currentRows.stream()
                .filter(r -> r.getId() != null)
                .collect(Collectors.toMap(KpiAssignmentUserTargetRow::getId, r -> r, (a, b) -> a));

        Map<UUID, UUID> assignmentIdByUser = currentRows.stream()
                .filter(r -> r.getUserId() != null)
                .collect(Collectors.toMap(
                        KpiAssignmentUserTargetRow::getUserId, KpiAssignmentUserTargetRow::getId, (a, b) -> a));

        LinkedHashSet<UUID> desiredSet = new LinkedHashSet<>(desired);
        LinkedHashSet<UUID> rowsToSoftDelete = new LinkedHashSet<>();

        for (KpiAssignmentUserTargetRow row : currentRows) {
            if (row.getUserId() == null)
                continue;
            if (shouldSoftDeleteStrategicAssignmentRow(row, desiredSet, type, role, actorId, rowsByAssignmentId)) {
                rowsToSoftDelete.add(row.getId());
                kpiAssignmentMapper.softDeleteKpiAssignmentById(row.getId(), cycleId, actorId);
            }
        }

        Map<UUID, UUID> activeAssignmentIdByUser = currentRows.stream()
                .filter(r -> r.getUserId() != null)
                .filter(r -> r.getId() != null && !rowsToSoftDelete.contains(r.getId()))
                .collect(Collectors.toMap(
                        KpiAssignmentUserTargetRow::getUserId, KpiAssignmentUserTargetRow::getId, (a, b) -> a));

        for (UUID uid : desired) {
            // Update child assignments
            BigDecimal rowTarget = teamTarget(type, uid, req, targetNum);
            UUID aid = activeAssignmentIdByUser.get(uid);
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
                String catalogJson = kpisInformationMapper.selectTargetDescriptionJson(kpiInfoId);
                pmRow.add(KpiAssignmentInsertRow.builder()
                        .id(parentAssignmentId)
                        .cycleId(cycleId)
                        .kpiInfoId(kpiInfoId)
                        .userId(actorId)
                        .jobTitleId(null)
                        .parentAssignmentId(null)
                        .targetValue(targetNum)
                        .scoringScale(resolveScoringScaleForInsert(null, cycleId, catalogJson))
                        .statusCode(Constants.AssignStatus.PENDING_ACCEPTANCE)
                        .createdBy(actorId)
                        .build());
                kpiAssignmentMapper.insertKpiAssignments(pmRow);
                kpiAssignmentSnapshotService.createSnapshotsForInsertRows(pmRow, actorId);
            }
        }

        List<UUID> newIds = desired.stream().filter(uid -> !activeAssignmentIdByUser.containsKey(uid)).toList();
        String catalogJson = kpisInformationMapper.selectTargetDescriptionJson(kpiInfoId);
        List<KpiAssignmentInsertRow> newRows = buildAssignmentRows(newIds, type, req, kpiInfoId, cycleId, targetNum,
                actorId, role, parentAssignmentId, catalogJson);
        promotionAssignmentValidationService.assertValidPromotionAssignmentsForInsertRows(
                type,
                newRows.stream()
                        .map(r -> new PromotionAssignmentValidationService.PromotionAssignmentInsert(
                                r.getUserId(), null, r.getPromotionCycleId()))
                        .toList());
        if (!newRows.isEmpty()) {
            kpiAssignmentMapper.insertKpiAssignments(newRows);
            kpiAssignmentSnapshotService.createSnapshotsForInsertRows(newRows, actorId);
        }
    }

    private List<KpiAssignmentInsertRow> buildAssignmentRows(
            List<UUID> userIds, int type, CreateStrategicKpiRequest req,
            UUID kpiInfoId, UUID cycleId, BigDecimal targetNum, UUID actorId, String role, UUID parentAssignmentId,
            String catalogScoringJson) {
        if (userIds.isEmpty())
            return new ArrayList<>();
        int initialStatus = initialAssignmentStatusForStrategicCreate(type, role);
        Map<UUID, UUID> jobByUser = loadJobTitleByUserId(userIds);
        String scoringForChildren = resolveScoringScaleForInsert(parentAssignmentId, cycleId, catalogScoringJson);
        UUID promotionCycleId = type == TYPE_PROMOTION ? req.getPromotionCycleId() : null;
        List<KpiAssignmentInsertRow> rows = new ArrayList<>();
        for (UUID uid : userIds) {
            BigDecimal rowTarget = teamTarget(type, uid, req, targetNum);
            rows.add(KpiAssignmentInsertRow.builder()
                    .id(UUID.randomUUID())
                    .cycleId(cycleId)
                    .kpiInfoId(kpiInfoId)
                    .userId(uid)
                    .jobTitleId(jobByUser.get(uid))
                    .parentAssignmentId(parentAssignmentId)
                    .targetValue(rowTarget)
                    .scoringScale(scoringForChildren)
                    .statusCode(initialStatus)
                    .createdBy(actorId)
                    .promotionCycleId(promotionCycleId)
                    .build());
        }
        return rows;
    }

    /**
     * Thang điểm khi tạo assignment: luôn lấy từ catalog KPI ({@code kpis_information.target_description}).
     * Target từng người nhận không được dùng để sinh thang điểm — assignee tự chỉnh qua
     * {@link com.company.kpi.service.common.AssigneeTargetScaleService} khi GM bật cờ cho phép.
     */
    private String resolveScoringScaleForInsert(UUID parentAssignmentId, UUID cycleId, String catalogScoringJson) {
        return catalogScoringJson;
    }

    /**
     * Member/Leader + KPI individual: chờ PM duyệt (402).
     * PM tạo / sửa sau GM reject: chờ chấp nhận (404) — PM gửi GM qua bulk 404→403.
     * GM và các role khác: chờ chấp nhận mục tiêu (404).
     */
    private static int initialAssignmentStatusForStrategicCreate(int type, String role) {
        if ((Constant.ROLE_MEMBER.equals(role) || Constant.ROLE_LEADER.equals(role))
                && type == TYPE_INDIVIDUAL) {
            return Constants.AssignStatus.PENDING_ACCEPTANCE;
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
                        "Team KPI: missing target for the selected PM");
            }
            String s = String.valueOf(raw).trim();
            if (s.isEmpty()) {
                throw AppException.badRequest(
                        "Team KPI: target value cannot be empty for PM");
            }
            try {
                BigDecimal val = normalizeTargetValue(new BigDecimal(s));
                if (val.compareTo(BigDecimal.ZERO) <= 0) {
                throw AppException.badRequest(
                        "Team KPI: PM target must be greater than 0");
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

    /**
     * GM/PM giao KPI mới — chặn theo nhóm: strategic (101+102) hoặc promotion (103).
     * Team (102): GM → PM; PM tạo/phân bổ → member (payload assignPMs).
     */
    private void assertMemberAssigneesEligibleForPmGmCreate(
            UUID cycleId, int type, List<UUID> assigneeUserIds, String role) {
        if (!Constant.ROLE_GM.equals(role) && !Constant.ROLE_PM.equals(role)) {
            return;
        }
        if (type == TYPE_TEAM) {
            if (assigneeUserIds.isEmpty()) {
                return;
            }
            if (Constant.ROLE_GM.equals(role)) {
                memberAssignmentEligibilityService.assertEligibleForNewPmAssignment(cycleId, assigneeUserIds);
            } else {
                memberAssignmentEligibilityService.assertEligibleForStrategicAssignment(
                        cycleId,
                        assigneeUserIds,
                        MemberAssignmentEligibility.BLOCK_ASSIGN_MEMBER_MESSAGE);
            }
            return;
        }
        if (type == TYPE_INDIVIDUAL || type == TYPE_PROMOTION) {
            memberAssignmentEligibilityService.assertEligibleForNewMemberAssignment(
                    cycleId, assigneeUserIds, type);
        }
    }

    private void assertMemberAssigneesEligibleForPmGmUpdate(
            UUID cycleId, UUID kpiInfoId, int type, List<UUID> desired, String role) {
        if (!Constant.ROLE_GM.equals(role) && !Constant.ROLE_PM.equals(role)) {
            return;
        }
        List<KpiAssignmentUserTargetRow> currentRows =
                kpiAssignmentMapper.listAssignmentUserTargets(kpiInfoId, cycleId);
        LinkedHashSet<UUID> currentAssigneeIds = new LinkedHashSet<>();
        for (KpiAssignmentUserTargetRow row : currentRows) {
            if (row.getUserId() == null) {
                continue;
            }
            if (type == TYPE_TEAM) {
                if (row.getParentAssignmentId() == null) {
                    currentAssigneeIds.add(row.getUserId());
                }
            } else {
                currentAssigneeIds.add(row.getUserId());
            }
        }
        List<UUID> newAssignees = desired.stream()
                .filter(uid -> !currentAssigneeIds.contains(uid))
                .toList();
        if (type == TYPE_TEAM) {
            if (newAssignees.isEmpty()) {
                return;
            }
            if (Constant.ROLE_GM.equals(role)) {
                memberAssignmentEligibilityService.assertEligibleForNewPmAssignment(cycleId, newAssignees);
            } else {
                memberAssignmentEligibilityService.assertEligibleForStrategicAssignment(
                        cycleId,
                        newAssignees,
                        MemberAssignmentEligibility.BLOCK_ASSIGN_MEMBER_MESSAGE);
            }
            return;
        }
        if (type == TYPE_INDIVIDUAL || type == TYPE_PROMOTION) {
            memberAssignmentEligibilityService.assertEligibleForNewMemberAssignment(
                    cycleId, newAssignees, type);
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

    private static void requirePositiveCatalogTargetIfPresent(BigDecimal targetNum) {
        if (targetNum != null && targetNum.compareTo(BigDecimal.ZERO) <= 0) {
            throw AppException.badRequest("targetValue must be greater than 0");
        }
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

    /** Member cascade đã qua 404/406 — không gỡ khỏi Team KPI và không đổi target khi lưu phân bổ. */
    private static boolean isCascadeChildAllocationLocked(int statusCode) {
        return statusCode != Constants.AssignStatus.PENDING_ACCEPTANCE
                && statusCode != Constants.AssignStatus.REJECTED;
    }

    @Transactional
    public void assignToMembers(AssignMemberRequest req, UUID userId) {
        Map<UUID, BigDecimal> requestedTargets = req.getMemberTargets() == null
                ? new LinkedHashMap<>()
                : new LinkedHashMap<>(req.getMemberTargets());
        for (Map.Entry<UUID, BigDecimal> entry : requestedTargets.entrySet()) {
            BigDecimal tv = normalizeTargetValue(entry.getValue());
            if (tv == null || tv.compareTo(BigDecimal.ZERO) <= 0) {
                throw AppException.badRequest(
                        "Allocation target must be greater than 0 for each assignee.");
            }
        }
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

            // Đồng bộ có chọn lọc: chỉ gỡ member bỏ chọn; member còn lại giữ assignment + status.
            // Member đã qua 404/406 (chờ Accept / từ chối) có thể sửa target; member ≥405/501+ giữ nguyên;
            // vẫn cho phép thêm member mới sau GM unlock PM.
            List<KpiAssignmentUserTargetRow> existingChildren =
                    kpiAssignmentMapper.listChildAssignmentsByParentId(req.getParentAssignmentId());
            LinkedHashSet<UUID> requestedUserIds = new LinkedHashSet<>(requestedTargets.keySet());
            for (KpiAssignmentUserTargetRow child : existingChildren) {
                UUID memberId = child.getUserId();
                if (memberId == null) {
                    continue;
                }
                int childStatus = child.getStatusCode() != null ? child.getStatusCode() : 0;
                if (!requestedUserIds.contains(memberId)) {
                    if (isCascadeChildAllocationLocked(childStatus)) {
                        throw AppException.badRequest(
                                "Cannot remove a member who has already accepted or submitted KPI results.");
                    }
                    kpiAssignmentMapper.softDeleteKpiAssignmentById(child.getId(), req.getCycleId(), userId);
                    continue;
                }
                if (isCascadeChildAllocationLocked(childStatus)) {
                    requestedTargets.remove(memberId);
                    continue;
                }
                BigDecimal newTarget = normalizeTargetValue(requestedTargets.get(memberId));
                kpiAssignmentMapper.updateKpiAssignmentTarget(
                        child.getId(), req.getCycleId(), newTarget, userId);
                requestedTargets.remove(memberId);
            }
        }

        if (requestedTargets.isEmpty()) {
            return;
        }

        memberAssignmentEligibilityService.assertEligibleForStrategicAssignment(
                req.getCycleId(),
                requestedTargets.keySet(),
                MemberAssignmentEligibility.BLOCK_ASSIGN_MEMBER_MESSAGE);

        List<UUID> assigneeUserIds = new ArrayList<>(requestedTargets.keySet());

        List<UUID> existingActiveUserIds = userMapper.listExistingActiveUserIds(assigneeUserIds);
        if (existingActiveUserIds.size() != assigneeUserIds.size()) {
            throw AppException.badRequest("One or more assignees are invalid or inactive.");
        }

        // 2. Lấy thông tin chức danh (Job Title) của các nhân viên được giao
        Map<UUID, UUID> jobByUser = userMapper.listUserJobTitlesByIds(assigneeUserIds).stream()
                .collect(Collectors.toMap(UserJobTitlePair::getUserId, UserJobTitlePair::getJobTitleId, (a, b) -> a));

        List<KpiAssignment> rowsToInsert = new ArrayList<>();
        String catalogJson = kpisInformationMapper.selectTargetDescriptionJson(req.getKpiInformationId());
        String scoringForCascade = resolveScoringScaleForInsert(
                req.getParentAssignmentId(), req.getCycleId(), catalogJson);

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
            assignment.setScoringScale(scoringForCascade);
            assignment.setStatusCode(statusCode);
            assignment.setCreatedBy(userId);

            rowsToInsert.add(assignment);
        }

        // 4. Batch Insert vào Database
        if (!rowsToInsert.isEmpty()) {
            kpiAssignmentMapper.insertKpiAssignmentsWithEntity(rowsToInsert);
            kpiAssignmentSnapshotService.createSnapshotsForAssignmentEntities(rowsToInsert, userId);
        }
    }

    /**
     * Sau khi PM duyệt feedback member (407→404): chỉ soft-delete và tạo lại assignment của member đó.
     * Các assignment cascade khác (vd. member đã Accept 405) giữ nguyên.
     */
    @Transactional
    public void replaceFeedbackMemberCascadeAssignment(
            UUID pmId,
            UUID cycleId,
            UUID kpiInformationId,
            UUID parentAssignmentId,
            UUID memberFeedbackAssignmentId,
            UUID memberUserId,
            BigDecimal targetValue) {
        if (parentAssignmentId == null) {
            throw AppException.badRequest("parentAssignmentId is required for team cascade feedback.");
        }
        int owned = kpiAssignmentMapper.countAssignmentOwnedByUserForKpiInfo(
                parentAssignmentId, pmId, kpiInformationId);
        if (owned < 1) {
            throw AppException.forbidden(
                    "Parent assignment is invalid, not owned by you, or does not match this KPI.");
        }
        boolean childUnderParent = kpiAssignmentMapper.listChildAssignmentsByParentId(parentAssignmentId).stream()
                .anyMatch(row -> memberFeedbackAssignmentId.equals(row.getId()));
        if (!childUnderParent) {
            throw AppException.badRequest("Feedback assignment is not a child of this team KPI.");
        }
        List<UUID> assigneeUserIds = List.of(memberUserId);
        List<UUID> existingActiveUserIds = userMapper.listExistingActiveUserIds(assigneeUserIds);
        if (existingActiveUserIds.size() != assigneeUserIds.size()) {
            throw AppException.badRequest("Feedback member is invalid or inactive.");
        }
        kpiAssignmentMapper.softDeleteKpiAssignmentById(memberFeedbackAssignmentId, cycleId, pmId);
        Map<UUID, UUID> jobByUser = userMapper.listUserJobTitlesByIds(assigneeUserIds).stream()
                .collect(Collectors.toMap(UserJobTitlePair::getUserId, UserJobTitlePair::getJobTitleId, (a, b) -> a));
        String catalogJson = kpisInformationMapper.selectTargetDescriptionJson(kpiInformationId);
        String scoringForCascade = resolveScoringScaleForInsert(parentAssignmentId, cycleId, catalogJson);
        KpiAssignment assignment = new KpiAssignment();
        assignment.setId(UUID.randomUUID());
        assignment.setCycleId(cycleId);
        assignment.setKpiInfoId(kpiInformationId);
        assignment.setUserId(memberUserId);
        assignment.setJobTitleId(jobByUser.get(memberUserId));
        assignment.setParentAssignmentId(parentAssignmentId);
        assignment.setTargetValue(normalizeTargetValue(targetValue));
        assignment.setScoringScale(scoringForCascade);
        assignment.setStatusCode(Constants.AssignStatus.PENDING_ACCEPTANCE);
        assignment.setCreatedBy(pmId);
        List<KpiAssignment> rowsToInsert = List.of(assignment);
        kpiAssignmentMapper.insertKpiAssignmentsWithEntity(rowsToInsert);
        kpiAssignmentSnapshotService.createSnapshotsForAssignmentEntities(rowsToInsert, pmId);
    }

    @Transactional
    public int updateStatusesKpi(UpdateKpiStatusRequest request, UUID currentUserId) {

        if (!Boolean.TRUE.equals(request.getBulkForManagedMembers())
                && request.getOnlyFromStatusCode() != null
                && request.getOnlyFromStatusCode() == Constants.AssignStatus.PENDING_ACCEPTANCE
                && request.getStatusCode() != null
                && (request.getStatusCode() == Constants.AssignStatus.ACCEPTED
                    || request.getStatusCode() == Constants.AssignStatus.WAITING_GM_APPROVAL)
                && !request.isPromotion()
                && !userMapper.userHasRoleCode(currentUserId, "GM")
                && kpiAssignmentMapper.existsTeamCascadeBlockingPmAccept(currentUserId, request.getCycleId())) {
            throw AppException.badRequest(
                    "Please allocate at least one member per Team KPI and wait for their confirmation before accepting the KPI.");
        }

        if (Boolean.TRUE.equals(request.getBulkForManagedMembers())
                && request.getStatusCode() != null
                && (request.getStatusCode() == 502 || request.getStatusCode() == 602)
                && request.getOnlyFromStatusCode() != null
                && (request.getOnlyFromStatusCode() == 501 || request.getOnlyFromStatusCode() == 601)
                && kpiAssignmentMapper.existsTeamMemberReviewBlockedByPmPendingAcceptance(
                        currentUserId,
                        request.getCycleId(),
                        request.getManagedMemberUserId(),
                        request.getOnlyFromStatusCode())) {
            throw AppException.badRequest(
                    "Accept the Team KPI before reviewing member evaluation results.");
        }

        // PM Personal Send Review must submit only PM-owned assignments, but Team KPI members
        // still have to be sent to GM first for the same phase.
        if (!Boolean.TRUE.equals(request.getBulkForManagedMembers())
                && !request.isPromotion()
                && request.getStatusCode() != null
                && (request.getStatusCode() == 502 || request.getStatusCode() == 602)) {
            int waitingGmStatus = request.getStatusCode();
            int completedStatus = waitingGmStatus == 502 ? 503 : 603;
            int blockingTeamMembers = kpiAssignmentMapper.countBlockingPmTeamMemberReviewsForSendReview(
                    currentUserId,
                    request.getCycleId(),
                    waitingGmStatus,
                    completedStatus);
            if (blockingTeamMembers > 0) {
                throw AppException.badRequest(waitingGmStatus == 502
                        ? "Please send all member Team KPIs to GM for mid-year review"
                        : "Please send all member Team KPIs to GM for year-end review");
            }
        }

        int updatedCount;
        if (Boolean.TRUE.equals(request.getBulkForManagedMembers())) {
            if (request.getManagedMemberUserId() != null) {
                updatedCount = kpiAssignmentMapper.updateKpiStatusesForPmManagedMemberSingle(
                        currentUserId,
                        request.getCycleId(),
                        request.getManagedMemberUserId(),
                        request.getStatusCode(),
                        request.isPromotion(),
                        request.getOnlyFromStatusCode(),
                        null);
            } else {
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
            }
        } else {
            updatedCount = kpiAssignmentMapper.updateKpiStatuses(
                    currentUserId,
                    request.getCycleId(),
                    request.getStatusCode(),
                    request.isPromotion(),
                    request.getOnlyFromStatusCode(),
                    request.getIncludeManagedDepartmentAssignments());
        }

        if (updatedCount == 0) {
            throw AppException.badRequest("Don't find KPI to update.");
        }

        persistSendReviewCommentIfNeeded(request, currentUserId);

        return updatedCount;
    }

    private void persistSendReviewCommentIfNeeded(UpdateKpiStatusRequest request, UUID currentUserId) {
        Integer nextStatus = request.getStatusCode();
        if (nextStatus == null || (nextStatus != 502 && nextStatus != 602)) {
            return;
        }
        if (request.getEvaluationComments() == null) {
            return;
        }
        String comment = Objects.toString(request.getEvaluationComments(), "").trim();
        boolean promotion = request.isPromotion();
        if (promotion) {
            int updated = userKpiSummaryMapper.updateEvaluationCommentsPromotion(
                    currentUserId, request.getCycleId(), comment, currentUserId);
            if (updated > 0) {
                return;
            }
            userKpiSummaryMapper.insertEvaluationComments(
                    UUID.randomUUID(),
                    currentUserId,
                    request.getCycleId(),
                    null,
                    comment,
                    currentUserId,
                    currentUserId);
        } else {
            int updated = userKpiSummaryMapper.updateEvaluationComments(
                    currentUserId, request.getCycleId(), comment, currentUserId);
            if (updated > 0) {
                return;
            }
            userKpiSummaryMapper.insertEvaluationComments(
                    UUID.randomUUID(),
                    currentUserId,
                    request.getCycleId(),
                    comment,
                    null,
                    currentUserId,
                    currentUserId);
        }
    }
}
