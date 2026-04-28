package com.company.kpi.service.kpi;

import com.company.kpi.aggregate.KpiAssignmentInsertRow;
import com.company.kpi.aggregate.KpiAssignmentUserTargetRow;
import com.company.kpi.aggregate.KpiInfoForDeleteRow;
import com.company.kpi.aggregate.KpiStrategicEditMasterRow;
import com.company.kpi.aggregate.UserJobTitlePair;
import com.company.kpi.common.constant.Constant;
import com.company.kpi.common.Constants;
import com.company.kpi.common.exception.AppException;
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
    private static final int TYPE_TEAM       = 102;
    private static final int TYPE_PROMOTION  = 103;
    private static final int STATUS_PENDING_ACCEPTANCE = 404;

    private final KpiCycleMapper kpiCycleMapper;
    private final KpiCategoryMapper kpiCategoryMapper;
    private final KpiMasterMapper kpiMasterMapper;
    private final KpisInformationMapper kpisInformationMapper;
    private final KpiAssignmentMapper kpiAssignmentMapper;
    private final UserMapper userMapper;

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

        CalcCodes calc   = CalcCodes.fromPersisted(req.getCalculationMethod());
        BigDecimal weight = normalizeWeight(req.getWeightPct());
        BigDecimal targetNum = normalizeTargetValue(req.getTargetValue());
        boolean important = Boolean.TRUE.equals(req.getIsImportant());

        List<UUID> assigneeUserIds = resolveAssigneeUserIds(req, type);
        if ((Constant.ROLE_MEMBER.equals(role) || Constant.ROLE_LEADER.equals(role)) && !assigneeUserIds.contains(actorId)) {
            assigneeUserIds.add(actorId);
        }


        UUID masterId = UUID.randomUUID();
        UUID infoId   = UUID.randomUUID();

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

        kpisInformationMapper.insertKpisInformation(
                infoId,
                req.getCycleId(),
                masterId,
                nullableTrim(req.getTargetDescription()),
                targetNum,
                weight,
                important,
                actorId);

        List<KpiAssignmentInsertRow> rows = buildAssignmentRows(
                assigneeUserIds, type, req, infoId, req.getCycleId(), targetNum, actorId);
        if (!rows.isEmpty()) {
            kpiAssignmentMapper.insertKpiAssignments(rows);
        }

        GmKpiCategoryResponse cat = kpiCategoryMapper.findActiveById(req.getPerspective()).orElse(null);

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
                .targetDescription(nullableTrim(req.getTargetDescription()))
                .targetValue(targetNum)
                .weight(weight)
                .isImportant(important)
                .assignmentsCreated(rows.size())
                .build();
    }

    // ── UPDATE ────────────────────────────────────────────────────────────────

    @Transactional
    public StrategicKpiResponse update(UUID kpiInformationId, CreateStrategicKpiRequest req, UUID actorId) {
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

        CalcCodes calc   = CalcCodes.fromPersisted(req.getCalculationMethod());
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

        kpisInformationMapper.updateKpisInformationStrategic(
                kpiInformationId,
                nullableTrim(req.getTargetDescription()),
                targetNum,
                weight,
                important,
                actorId);

        List<UUID> desired = resolveAssigneeUserIds(req, type);

        if (typeChanged) {
            kpiAssignmentMapper.softDeleteAssignmentsForKpiInformation(
                    kpiInformationId, existing.getCycleId(), actorId);
            List<KpiAssignmentInsertRow> rows = buildAssignmentRows(
                    desired, type, req, kpiInformationId, existing.getCycleId(), targetNum, actorId);
            if (!rows.isEmpty()) {
                kpiAssignmentMapper.insertKpiAssignments(rows);
            }
        } else {
            syncAssignments(kpiInformationId, existing.getCycleId(), desired, type, req, targetNum, actorId);
        }

        int assignmentCount = kpiAssignmentMapper.listAssignmentUserTargets(kpiInformationId, existing.getCycleId()).size();
        GmKpiCategoryResponse cat = kpiCategoryMapper.findActiveById(req.getPerspective()).orElse(null);

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
                .targetDescription(nullableTrim(req.getTargetDescription()))
                .targetValue(targetNum)
                .weight(weight)
                .isImportant(important)
                .assignmentsCreated(assignmentCount)
                .build();
    }

    // ── GET FOR EDIT ──────────────────────────────────────────────────────────

    public StrategicKpiEditResponse getForEdit(UUID kpiInformationId, UUID actorId) {
        KpiStrategicEditMasterRow row = kpisInformationMapper.selectStrategicKpiEditMaster(kpiInformationId);
        if (row == null) {
            throw AppException.notFound("KPI information not found: " + kpiInformationId);
        }
        if (!Boolean.TRUE.equals(row.getIsGlobal())) {
            throw AppException.forbidden("Only global strategic KPIs can be viewed for edit.");
        }

        List<KpiAssignmentUserTargetRow> assigns =
                kpiAssignmentMapper.listAssignmentUserTargets(kpiInformationId, row.getCycleId());

        String calcMethod = StrategicKpiCalcMapper.fromDb(row.getCalculationTypeCode(), row.getCalculationRuleCode());

        StrategicKpiEditResponse.StrategicKpiEditResponseBuilder b = StrategicKpiEditResponse.builder()
                .kpiInformationId(row.getKpiInformationId())
                .cycleId(row.getCycleId())
                .masterKpiId(row.getMasterKpiId())
                .typeCode(row.getTypeCode())
                .perspective(row.getCategoryId())
                .kpiName(row.getKpiName())
                .targetDescription(row.getTargetDescription())
                .targetValue(row.getTargetValue())
                .unitCode(row.getUnitCode())
                .weightPct(row.getWeight())
                .calculationMethod(calcMethod)
                .isImportant(Boolean.TRUE.equals(row.getIsImportant()));

        if (row.getTypeCode() != null && row.getTypeCode() == TYPE_TEAM) {
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
                        (existing, replacement) -> existing
                ));
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
                                  BigDecimal targetNum, UUID actorId) {
        List<KpiAssignmentUserTargetRow> currentRows =
                kpiAssignmentMapper.listAssignmentUserTargets(kpiInfoId, cycleId);

        Map<UUID, UUID> assignmentIdByUser = currentRows.stream()
                .filter(r -> r.getUserId() != null)
                .collect(Collectors.toMap(
                        KpiAssignmentUserTargetRow::getUserId, KpiAssignmentUserTargetRow::getId, (a, b) -> a));

        LinkedHashSet<UUID> desiredSet = new LinkedHashSet<>(desired);

        for (KpiAssignmentUserTargetRow row : currentRows) {
            if (row.getUserId() == null) continue;
            if (!desiredSet.contains(row.getUserId())) {
                kpiAssignmentMapper.softDeleteKpiAssignmentById(row.getId(), cycleId, actorId);
            }
        }

        for (UUID uid : desired) {
            BigDecimal rowTarget = teamTarget(type, uid, req, targetNum);
            UUID aid = assignmentIdByUser.get(uid);
            if (aid != null) {
                kpiAssignmentMapper.updateKpiAssignmentTarget(aid, cycleId, rowTarget, actorId);
            }
        }

        List<UUID> newIds = desired.stream().filter(uid -> !assignmentIdByUser.containsKey(uid)).toList();
        List<KpiAssignmentInsertRow> newRows = buildAssignmentRows(newIds, type, req, kpiInfoId, cycleId, targetNum, actorId);
        if (!newRows.isEmpty()) {
            kpiAssignmentMapper.insertKpiAssignments(newRows);
        }
    }

    private List<KpiAssignmentInsertRow> buildAssignmentRows(
            List<UUID> userIds, int type, CreateStrategicKpiRequest req,
            UUID kpiInfoId, UUID cycleId, BigDecimal targetNum, UUID actorId) {
        if (userIds.isEmpty()) return List.of();
        Map<UUID, UUID> jobByUser = loadJobTitleByUserId(userIds);
        List<KpiAssignmentInsertRow> rows = new ArrayList<>();
        for (UUID uid : userIds) {
            rows.add(KpiAssignmentInsertRow.builder()
                    .id(UUID.randomUUID())
                    .cycleId(cycleId)
                    .kpiInfoId(kpiInfoId)
                    .userId(uid)
                    .jobTitleId(jobByUser.get(uid))
                    .targetValue(teamTarget(type, uid, req, targetNum))
                    .statusCode(STATUS_PENDING_ACCEPTANCE)
                    .createdBy(actorId)
                    .build());
        }
        return rows;
    }

    private static BigDecimal teamTarget(int type, UUID userId, CreateStrategicKpiRequest req, BigDecimal fallback) {
        if (type != TYPE_TEAM) return fallback;
        Map<String, Object> pm = req.getPmTargets();
        if (pm == null || pm.isEmpty()) return fallback;
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
        if (raw == null) return fallback;
        if (raw instanceof BigDecimal bd) return normalizeTargetValue(bd);
        if (raw instanceof Number n) return normalizeTargetValue(BigDecimal.valueOf(n.doubleValue()));
        String s = String.valueOf(raw).trim();
        if (s.isEmpty()) return fallback;
        try {
            return normalizeTargetValue(new BigDecimal(s));
        } catch (NumberFormatException ex) {
            throw AppException.badRequest("pmTargets has invalid number for user " + userId + ": " + s);
        }
    }

    private List<UUID> resolveAssigneeUserIds(CreateStrategicKpiRequest req, int type) {
        List<UUID> ids = (type == TYPE_TEAM) ? req.getAssignPMs() : req.getMemberIds();
        if (ids == null || ids.isEmpty()) return new ArrayList<>();
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
            throw AppException.badRequest("typeCode must be 101 (individual), 102 (team/cascading), or 103 (promotion).");
        }
    }

    private static String nullableTrim(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String truncate(String s, int max) {
        String t = s.trim();
        return t.length() <= max ? t : t.substring(0, max);
    }

    private static BigDecimal normalizeWeight(BigDecimal raw) {
        if (raw == null) throw AppException.badRequest("weightPct is required.");
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
     * DB code (ruleCode, typeCode) → persisted string — đồng bộ kpi-fe kpiCalculationCodes.ts.
     */
    static final class StrategicKpiCalcMapper {
        private StrategicKpiCalcMapper() {}

        static String fromDb(Integer typeCode, Integer ruleCode) {
            int rule = ruleCode != null ? ruleCode : 802;
            if (rule == 801) return "mean_plan_actual_sum";
            if (rule == 803) return "manual_member_input";
            if (rule == 802) {
                if (typeCode != null && typeCode == 702) return "mean_plan_actual";
                if (typeCode != null && typeCode == 701) return "mean_actual_plan";
                return "mean_plan_actual_pct";
            }
            return "mean_actual_plan";
        }

        static CalcCodes fromPersisted(String persisted) {
            String k = persisted == null ? "" : persisted.trim();
            return switch (k) {
                case "manual_member_input"  -> new CalcCodes(803, 703);
                case "mean_actual_plan"     -> new CalcCodes(802, 701);
                case "mean_plan_actual"     -> new CalcCodes(802, 702);
                case "mean_plan_actual_pct" -> new CalcCodes(802, 701);
                case "mean_plan_actual_sum" -> new CalcCodes(801, null);
                default                     -> new CalcCodes(802, 701);
            };
        }
    }

    private record CalcCodes(int ruleCode, Integer typeCode) {
        static CalcCodes fromPersisted(String p) { return StrategicKpiCalcMapper.fromPersisted(p); }
    }

    @Transactional
    public void assignToMembers(AssignMemberRequest req, UUID userId) {
        if (req.getMemberTargets() == null || req.getMemberTargets().isEmpty()) {
            throw AppException.badRequest("At least one member must be selected for assignment.");
        }

        List<UUID> assigneeUserIds = new ArrayList<>(req.getMemberTargets().keySet());

        // 2. Lấy thông tin chức danh (Job Title) của các nhân viên được giao
        Map<UUID, UUID> jobByUser = userMapper.listUserJobTitlesByIds(assigneeUserIds).stream()
                .collect(Collectors.toMap(UserJobTitlePair::getUserId, UserJobTitlePair::getJobTitleId, (a, b) -> a));

        List<KpiAssignment> rowsToInsert = new ArrayList<>();

        // 3. Build data insert cho từng member
        for (Map.Entry<UUID, BigDecimal> entry : req.getMemberTargets().entrySet()) {
            UUID memberId = entry.getKey();
            BigDecimal targetValue = normalizeTargetValue(entry.getValue());

            KpiAssignment assignment = new KpiAssignment();
            assignment.setId(UUID.randomUUID());
            assignment.setCycleId(req.getCycleId());
            assignment.setKpiInfoId(req.getKpiInformationId());
            assignment.setUserId(memberId);
            assignment.setJobTitleId(jobByUser.get(memberId));
            assignment.setParentAssignmentId(req.getParentAssignmentId());
            assignment.setTargetValue(targetValue);
            assignment.setStatusCode(Constants.AssignStatus.PENDING_ACCEPTANCE);
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

        // Thực thi update hàng loạt
        int updatedCount = kpiAssignmentMapper.updateKpiStatuses(
                currentUserId,
                request.getCycleId(),
                request.getStatusCode(),
                request.isPromotion()
        );

        if (updatedCount == 0) {
            throw AppException.badRequest("Don't find KPI to update.");
        }

        return updatedCount;
    }
}
