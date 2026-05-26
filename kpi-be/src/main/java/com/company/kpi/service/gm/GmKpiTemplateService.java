package com.company.kpi.service.gm;

import com.company.kpi.common.exception.AppException;
import com.company.kpi.entity.KpiCycle;
import com.company.kpi.entity.KpisInformation;
import com.company.kpi.mapper.KpiCategoryMapper;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.mapper.KpiTemplateMapper;
import com.company.kpi.mapper.KpiMasterMapper;
import com.company.kpi.mapper.KpisInformationMapper;
import com.company.kpi.mapper.KpiAssignmentMapper;
import com.company.kpi.mapper.UserMapper;
import com.company.kpi.aggregate.KpiTemplateEntityRow;
import com.company.kpi.aggregate.KpiTemplateItemEditRow;
import com.company.kpi.request.gm.CreateKpiTemplateItemRequest;
import com.company.kpi.request.gm.CreateKpiTemplateRequest;
import com.company.kpi.request.gm.UpdateKpiTemplateItemRequest;
import com.company.kpi.request.gm.UpdateKpiTemplateRequest;
import com.company.kpi.response.gm.GmKpiTemplateItemResponse;
import com.company.kpi.response.gm.GmKpiTemplatePackageResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Year;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GmKpiTemplateService {

    private static final int TYPE_INDIVIDUAL = 101;
    private static final int TYPE_TEAM = 102;
    private static final int TYPE_PROMOTION = 103;

    private final KpiTemplateMapper kpiTemplateMapper;
    private final KpiCategoryMapper kpiCategoryMapper;
        private final KpiMasterMapper kpiMasterMapper;
    private final KpisInformationMapper kpisInformationMapper;
    private final KpiAssignmentMapper kpiAssignmentMapper;
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;
    private final KpiCycleMapper kpiCycleMapper;

    public List<GmKpiTemplatePackageResponse> listPackages() {
        return kpiTemplateMapper.listActiveTemplates();
    }

    public List<GmKpiTemplateItemResponse> listItems(UUID templateId, Integer year) {
        assertActiveTemplate(templateId);
        return kpiTemplateMapper.listItemsByTemplateId(templateId, resolveCycleYear(year));
    }

    @Transactional
    public GmKpiTemplatePackageResponse createTemplate(CreateKpiTemplateRequest req) {
        validateJobFamilyAndRank(req.getJobFamilyId(), req.getRankId());
        UUID id = UUID.randomUUID();
        String name = truncate(req.getName().trim(), 255);
        String desc = nullableTrim(req.getDescription());
        kpiTemplateMapper.insertTemplate(id, name, desc, req.getJobFamilyId(), req.getRankId());
        GmKpiTemplatePackageResponse res = new GmKpiTemplatePackageResponse();
        res.setId(id);
        res.setName(name);
        res.setDescription(desc);
        return res;
    }

    @Transactional
    public GmKpiTemplatePackageResponse updateTemplate(UUID templateId, UpdateKpiTemplateRequest req) {
        KpiTemplateEntityRow cur = kpiTemplateMapper.selectActiveTemplateEntityById(templateId);
        if (cur == null) {
            throw AppException.notFound("KPI template not found: " + templateId);
        }
        String name = cur.getName();
        if (req.getName() != null) {
            String trimmed = req.getName().trim();
            if (trimmed.isEmpty()) {
                throw AppException.badRequest("name cannot be empty.");
            }
            name = truncate(trimmed, 255);
        }
        String desc = cur.getDescription();
        if (req.getDescription() != null) {
            desc = nullableTrim(req.getDescription());
        }
        UUID jf = cur.getJobFamilyId();
        if (req.getJobFamilyId() != null) {
            jf = req.getJobFamilyId();
        }
        UUID rk = cur.getRankId();
        if (req.getRankId() != null) {
            rk = req.getRankId();
        }
        validateJobFamilyAndRank(jf, rk);
        int n = kpiTemplateMapper.updateTemplate(templateId, name, desc, jf, rk);
        if (n < 1) {
            throw AppException.notFound("KPI template not found: " + templateId);
        }
        KpiTemplateEntityRow after = kpiTemplateMapper.selectActiveTemplateEntityById(templateId);
        return toPackage(after);
    }

    @Transactional
    public void deleteTemplate(UUID templateId, UUID gmUserId) {
        assertActiveTemplate(templateId);
        List<UUID> masters = kpiTemplateMapper.listDistinctMasterIdsByTemplateId(templateId);
        kpiTemplateMapper.deleteTemplateItemsByTemplateId(templateId);
        int d = kpiTemplateMapper.softDeleteTemplateById(templateId);
        if (d < 1) {
            throw AppException.notFound("KPI template not found: " + templateId);
        }
        for (UUID masterId : masters) {
            maybeSoftDeleteOrphanMaster(masterId, gmUserId);
        }
    }

    @Transactional
    public GmKpiTemplateItemResponse createTemplateItem(
            UUID templateId, CreateKpiTemplateItemRequest req, UUID gmUserId) {
        assertActiveTemplate(templateId);
        if (kpiCategoryMapper.countActiveById(req.getPerspective()) < 1) {
            throw AppException.badRequest("Invalid or inactive KPI category (perspective): " + req.getPerspective());
        }
        int type = req.getTypeCode();
        if (type != TYPE_INDIVIDUAL && type != TYPE_TEAM && type != TYPE_PROMOTION) {
            throw AppException.badRequest("typeCode must be 101 (individual), 102 (team/cascading), or 103 (promotion).");
        }
        CalcCodes calc = CalcCodes.fromPersisted(req.getCalculationMethod());
        BigDecimal weight = normalizeWeight(req.getDefaultWeight());
        BigDecimal targetNum = normalizeTargetValue(req.getDefaultTargetValue());
        String targetDescription = serializeTargetDescription(req.getTargetDescription());

        UUID masterId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        kpiMasterMapper.insertKpiMaster(
                masterId,
                truncate(req.getKpiName().trim(), 255),
                req.getPerspective(),
                type,
                calc.ruleCode(),
                calc.typeCode(),
                req.getUnitCode(),
                false,
                gmUserId);
        boolean important = Boolean.TRUE.equals(req.getIsImportant());
        boolean allowAssigneeEdit = Boolean.TRUE.equals(req.getAllowAssigneeTargetScaleEdit());
        kpiTemplateMapper.insertTemplateItem(
                itemId, templateId, masterId, targetDescription, targetNum, weight, important, allowAssigneeEdit);
        GmKpiTemplateItemResponse row =
                kpiTemplateMapper.selectTemplateItemResponse(templateId, itemId, resolveCycleYear(req.getCycleYear()));
        if (row == null) {
            throw AppException.badRequest("Failed to load created template item.");
        }
        return row;
    }

    @Transactional
    public GmKpiTemplateItemResponse updateTemplateItem(
            UUID templateId, UUID itemId, UpdateKpiTemplateItemRequest req, UUID gmUserId) {
        assertActiveTemplate(templateId);
        KpiTemplateItemEditRow row = kpiTemplateMapper.selectTemplateItemEditRow(templateId, itemId);
        if (row == null) {
            throw AppException.notFound("KPI template item not found: " + itemId);
        }
        String name = req.getKpiName() != null ? truncate(req.getKpiName().trim(), 255) : row.getKpiName();
        UUID categoryId = req.getPerspective() != null ? req.getPerspective() : row.getCategoryId();
        if (req.getPerspective() != null && kpiCategoryMapper.countActiveById(req.getPerspective()) < 1) {
            throw AppException.badRequest("Invalid or inactive KPI category (perspective): " + req.getPerspective());
        }
        Integer typeBox = req.getTypeCode() != null ? req.getTypeCode() : row.getTypeCode();
        if (typeBox == null) {
            throw AppException.badRequest("typeCode is required.");
        }
        int type = typeBox;
        if (type != TYPE_INDIVIDUAL && type != TYPE_TEAM && type != TYPE_PROMOTION) {
            throw AppException.badRequest("typeCode must be 101 (individual), 102 (team/cascading), or 103 (promotion).");
        }
        Integer unitBox = req.getUnitCode() != null ? req.getUnitCode() : row.getUnitCode();
        if (unitBox == null) {
            throw AppException.badRequest("unitCode is required.");
        }
        int unit = unitBox;
        int rule = row.getCalculationRuleCode() != null ? row.getCalculationRuleCode() : 802;
        Integer typeCode = row.getCalculationTypeCode();
        if (req.getCalculationMethod() != null) {
            CalcCodes c = CalcCodes.fromPersisted(req.getCalculationMethod());
            rule = c.ruleCode();
            typeCode = c.typeCode();
        }
        BigDecimal weight =
                req.getDefaultWeight() != null ? normalizeWeight(req.getDefaultWeight()) : row.getDefaultWeight();
        BigDecimal target =
                req.getDefaultTargetValue() != null
                        ? normalizeTargetValue(req.getDefaultTargetValue())
                        : row.getDefaultTargetValue();
        String targetDescription = serializeTargetDescription(req.getTargetDescription());

        int um = kpiMasterMapper.updateKpiMasterStrategic(
                row.getMasterKpiId(), name, categoryId, type, rule, typeCode, unit, gmUserId);
        if (um < 1) {
            throw AppException.notFound("kpi_master not found: " + row.getMasterKpiId());
        }
        boolean important =
                req.getIsImportant() != null
                        ? Boolean.TRUE.equals(req.getIsImportant())
                        : Boolean.TRUE.equals(row.getIsImportant());
        boolean allowAssigneeEdit =
                req.getAllowAssigneeTargetScaleEdit() != null
                        ? Boolean.TRUE.equals(req.getAllowAssigneeTargetScaleEdit())
                        : Boolean.TRUE.equals(row.getAllowAssigneeTargetScaleEdit());
        kpiTemplateMapper.updateTemplateItemDefaults(
                templateId, itemId, targetDescription, target, weight, important, allowAssigneeEdit);
        GmKpiTemplateItemResponse out =
                kpiTemplateMapper.selectTemplateItemResponse(templateId, itemId, resolveCycleYear(req.getCycleYear()));
        if (out == null) {
            throw AppException.badRequest("Failed to load updated template item.");
        }
        return out;
    }

    @Transactional
    public void deleteTemplateItem(UUID templateId, UUID itemId, UUID gmUserId) {
        assertActiveTemplate(templateId);
        KpiTemplateItemEditRow row = kpiTemplateMapper.selectTemplateItemEditRow(templateId, itemId);
        if (row == null) {
            throw AppException.notFound("KPI template item not found: " + itemId);
        }
        UUID masterId = row.getMasterKpiId();
        int del = kpiTemplateMapper.deleteTemplateItemByTemplateAndId(templateId, itemId);
        if (del < 1) {
            throw AppException.notFound("KPI template item not found: " + itemId);
        }
        maybeSoftDeleteOrphanMaster(masterId, gmUserId);
    }

    private void assertActiveTemplate(UUID templateId) {
        if (kpiTemplateMapper.countActiveTemplateById(templateId) < 1) {
            throw AppException.notFound("KPI template not found: " + templateId);
        }
    }

    private void validateJobFamilyAndRank(UUID jobFamilyId, UUID rankId) {
        if (jobFamilyId != null && kpiTemplateMapper.countActiveJobFamilyById(jobFamilyId) < 1) {
            throw AppException.badRequest("Invalid or inactive job family: " + jobFamilyId);
        }
        if (rankId != null && kpiTemplateMapper.countActiveRankById(rankId) < 1) {
            throw AppException.badRequest("Invalid or inactive rank: " + rankId);
        }
    }

    private void maybeSoftDeleteOrphanMaster(UUID masterKpiId, UUID gmUserId) {
        if (kpisInformationMapper.countActiveKpisInformationByMasterKpiId(masterKpiId) > 0) {
            return;
        }
        if (kpiTemplateMapper.countActiveTemplateItemsByMasterKpiId(masterKpiId) > 0) {
            return;
        }
        kpiMasterMapper.softDeleteKpiMasterById(masterKpiId, gmUserId);
    }

    private static GmKpiTemplatePackageResponse toPackage(KpiTemplateEntityRow row) {
        GmKpiTemplatePackageResponse r = new GmKpiTemplatePackageResponse();
        r.setId(row.getId());
        r.setName(row.getName());
        r.setDescription(row.getDescription());
        return r;
    }

    private static String nullableTrim(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String truncate(String s, int max) {
        String t = s.trim();
        return t.length() <= max ? t : t.substring(0, max);
    }

    private static BigDecimal normalizeWeight(BigDecimal raw) {
        if (raw == null) {
            throw AppException.badRequest("defaultWeight is required.");
        }
        BigDecimal w = raw.setScale(2, RoundingMode.HALF_UP);
        if (w.compareTo(BigDecimal.ZERO) <= 0 || w.compareTo(new BigDecimal("1000")) > 0) {
            throw AppException.badRequest("defaultWeight must be between 0 and 1000.");
        }
        return w;
    }

    private static BigDecimal normalizeTargetValue(BigDecimal raw) {
        if (raw == null) {
            return null;
        }
        return raw.setScale(4, RoundingMode.HALF_UP);
    }

    private String serializeTargetDescription(Object targetDescription) {
        if (targetDescription == null) {
            return null;
        }
        if (targetDescription instanceof String s) {
            String trimmed = s.trim();
            return trimmed.isEmpty() ? null : trimmed;
        }
        try {
            return objectMapper.writeValueAsString(targetDescription);
        } catch (JsonProcessingException e) {
            throw AppException.badRequest("Invalid targetDescription payload.");
        }
    }

    private int resolveCycleYear(Integer year) {
        return year != null ? year : Year.now().getValue();
    }



    /** Đồng bềE{@code kpi-fe} persisted calculation keys ↁE(rule, type). */
    private record CalcCodes(int ruleCode, Integer typeCode) {
        static CalcCodes fromPersisted(String persisted) {
            String k = String.valueOf(persisted == null ? "" : persisted).trim();
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
}

