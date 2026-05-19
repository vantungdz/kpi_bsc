package com.company.kpi.service.gm;

import com.company.kpi.common.Constants;
import com.company.kpi.common.exception.AppException;
import com.company.kpi.entity.KpiCycle;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.mapper.PerformanceRatingScaleMapper;
import com.company.kpi.request.gm.CreateGmRatingScaleRequest;
import com.company.kpi.request.gm.SaveGmRatingScaleLevelRequest;
import com.company.kpi.response.gm.GmRatingScaleCycleStatusResponse;
import com.company.kpi.response.gm.GmRatingScaleDetailResponse;
import com.company.kpi.response.gm.GmRatingScaleLevelResponse;
import com.company.kpi.response.gm.GmRatingScaleSummaryResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GmRatingScaleService {

    private final PerformanceRatingScaleMapper performanceRatingScaleMapper;
    private final KpiCycleMapper kpiCycleMapper;

    public List<GmRatingScaleSummaryResponse> listScales() {
        return performanceRatingScaleMapper.listCycleSummaries();
    }

    public GmRatingScaleDetailResponse getByYear(int year) {
        GmRatingScaleSummaryResponse summary =
                performanceRatingScaleMapper.findCycleSummaryByYear(year);
        if (summary == null) {
            throw AppException.notFound("Không tìm thấy kỳ đánh giá năm " + year + ".");
        }
        return toDetail(summary);
    }

    @Transactional
    public GmRatingScaleDetailResponse createScale(CreateGmRatingScaleRequest req, UUID actorId) {
        UUID cycleId = req.getCycleId();
        GmRatingScaleSummaryResponse cycleRow =
                performanceRatingScaleMapper.findCycleSummaryByCycleId(cycleId);
        if (cycleRow == null) {
            throw AppException.notFound("Không tìm thấy kỳ đánh giá.");
        }
        assertEditable(cycleRow);
        if (performanceRatingScaleMapper.countLevelsByCycleId(cycleId) > 0) {
            throw AppException.badRequest(
                    "Đã tồn tại khung điểm cho năm " + cycleRow.getYear() + ".");
        }

        if (req.getCopyFromCycleId() != null) {
            copyLevelsFromCycle(req.getCopyFromCycleId(), cycleId, actorId);
        }

        return toDetail(performanceRatingScaleMapper.findCycleSummaryByCycleId(cycleId));
    }

    @Transactional
    public GmRatingScaleCycleStatusResponse updateCycleStatus(
            UUID cycleId, int statusCode, UUID actorId) {
        if (statusCode != Constants.CycleStatus.OPEN
                && statusCode != Constants.CycleStatus.CLOSED) {
            throw AppException.badRequest("status_code chỉ được là 201 (mở) hoặc 202 (đóng).");
        }
        KpiCycle cycle = kpiCycleMapper
                .findById(cycleId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy kỳ đánh giá."));

        if (statusCode == Constants.CycleStatus.OPEN) {
            if (Objects.equals(cycle.getStatusCode(), Constants.CycleStatus.OPEN)) {
                return toCycleStatusResponse(cycle);
            }
            if (kpiCycleMapper.countOtherOpenCycles(cycleId) > 0) {
                throw AppException.badRequest(
                        "Đã có một năm đánh giá đang mở (201). Vui lòng đóng năm đó trước khi mở năm khác.");
            }
            kpiCycleMapper.updateCycleStatus(cycleId, Constants.CycleStatus.OPEN, actorId);
        } else {
            if (Objects.equals(cycle.getStatusCode(), Constants.CycleStatus.CLOSED)) {
                return toCycleStatusResponse(cycle);
            }
            kpiCycleMapper.updateCycleStatus(cycleId, Constants.CycleStatus.CLOSED, actorId);
        }

        return kpiCycleMapper
                .findById(cycleId)
                .map(this::toCycleStatusResponse)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy kỳ đánh giá."));
    }

    @Transactional
    public GmRatingScaleLevelResponse addLevel(
            UUID cycleId, SaveGmRatingScaleLevelRequest req, UUID actorId) {
        assertEditableCycle(cycleId);
        validateLevel(req);
        UUID id = UUID.randomUUID();
        performanceRatingScaleMapper.insertLevel(
                id,
                cycleId,
                req.getSortOrder(),
                req.getLevelCode().trim().toUpperCase(),
                req.getLabel().trim(),
                req.getMinScore(),
                req.getMaxScore(),
                req.getPitch(),
                normalizeColor(req.getColorHex()),
                Boolean.TRUE.equals(req.getTopTier()),
                actorId);
        return findLevelOrThrow(cycleId, id);
    }

    @Transactional
    public GmRatingScaleLevelResponse updateLevel(
            UUID cycleId, UUID levelId, SaveGmRatingScaleLevelRequest req, UUID actorId) {
        assertEditableCycle(cycleId);
        validateLevel(req);
        ensureLevelBelongsToCycle(cycleId, levelId);
        performanceRatingScaleMapper.updateLevel(
                levelId,
                req.getSortOrder(),
                req.getLevelCode().trim().toUpperCase(),
                req.getLabel().trim(),
                req.getMinScore(),
                req.getMaxScore(),
                req.getPitch(),
                normalizeColor(req.getColorHex()),
                Boolean.TRUE.equals(req.getTopTier()),
                actorId);
        return findLevelOrThrow(cycleId, levelId);
    }

    @Transactional
    public void deleteLevel(UUID cycleId, UUID levelId, UUID actorId) {
        assertEditableCycle(cycleId);
        ensureLevelBelongsToCycle(cycleId, levelId);
        int n = performanceRatingScaleMapper.softDeleteLevel(levelId, actorId);
        if (n == 0) {
            throw AppException.notFound("Không tìm thấy mức điểm.");
        }
    }

    private void copyLevelsFromCycle(UUID sourceCycleId, UUID targetCycleId, UUID actorId) {
        if (sourceCycleId.equals(targetCycleId)) {
            throw AppException.badRequest("Không thể sao chép từ cùng một chu kỳ.");
        }
        if (performanceRatingScaleMapper.countLevelsByCycleId(sourceCycleId) == 0) {
            throw AppException.badRequest("Chu kỳ nguồn chưa có mức điểm để sao chép.");
        }
        List<GmRatingScaleLevelResponse> sourceLevels =
                performanceRatingScaleMapper.listLevelsByCycleId(sourceCycleId);
        for (GmRatingScaleLevelResponse src : sourceLevels) {
            performanceRatingScaleMapper.insertLevel(
                    UUID.randomUUID(),
                    targetCycleId,
                    src.getSortOrder(),
                    src.getLevelCode(),
                    src.getLabel(),
                    src.getMinScore(),
                    src.getMaxScore(),
                    src.getPitch(),
                    src.getColorHex(),
                    Boolean.TRUE.equals(src.getTopTier()),
                    actorId);
        }
    }

    private GmRatingScaleDetailResponse toDetail(GmRatingScaleSummaryResponse summary) {
        GmRatingScaleDetailResponse out = new GmRatingScaleDetailResponse();
        out.setCycleId(summary.getCycleId());
        out.setYear(summary.getYear());
        out.setName(summary.getName());
        out.setStatusCode(summary.getStatusCode());
        out.setEditable(summary.getEditable());
        UUID cycleId = UUID.fromString(summary.getCycleId());
        List<GmRatingScaleLevelResponse> levels =
                performanceRatingScaleMapper.listLevelsByCycleId(cycleId);
        out.setLevels(levels);
        out.setHasScale(!levels.isEmpty());
        return out;
    }

    private GmRatingScaleCycleStatusResponse toCycleStatusResponse(KpiCycle cycle) {
        GmRatingScaleCycleStatusResponse out = new GmRatingScaleCycleStatusResponse();
        out.setCycleId(cycle.getId().toString());
        out.setYear(cycle.getYear());
        out.setName(cycle.getName());
        out.setStatusCode(cycle.getStatusCode());
        out.setEditable(Objects.equals(cycle.getStatusCode(), Constants.CycleStatus.OPEN));
        return out;
    }

    private GmRatingScaleLevelResponse findLevelOrThrow(UUID cycleId, UUID levelId) {
        return performanceRatingScaleMapper.listLevelsByCycleId(cycleId).stream()
                .filter(l -> levelId.toString().equals(l.getId()))
                .findFirst()
                .orElseThrow(() -> AppException.notFound("Không tìm thấy mức điểm."));
    }

    private void ensureLevelBelongsToCycle(UUID cycleId, UUID levelId) {
        findLevelOrThrow(cycleId, levelId);
    }

    private void assertEditableCycle(UUID cycleId) {
        Integer status = performanceRatingScaleMapper.findStatusCodeByCycleId(cycleId);
        if (status == null) {
            throw AppException.notFound("Không tìm thấy kỳ đánh giá.");
        }
        assertOpenStatus(status);
    }

    private static void assertEditable(GmRatingScaleSummaryResponse row) {
        if (!Boolean.TRUE.equals(row.getEditable())) {
            throw AppException.forbidden(
                    "Kỳ đánh giá đã đóng (202). Chỉ kỳ đang mở (201) mới được chỉnh sửa khung điểm.");
        }
    }

    private static void assertOpenStatus(int statusCode) {
        if (statusCode != Constants.CycleStatus.OPEN) {
            throw AppException.forbidden(
                    "Kỳ đánh giá đã đóng (202). Chỉ kỳ đang mở (201) mới được chỉnh sửa khung điểm.");
        }
    }

    private static void validateLevel(SaveGmRatingScaleLevelRequest req) {
        if (req.getMaxScore() != null && req.getMinScore().compareTo(req.getMaxScore()) > 0) {
            throw AppException.badRequest("Điểm tối thiểu không được lớn hơn điểm tối đa.");
        }
        if (req.getPitch() != null && req.getPitch().compareTo(BigDecimal.ZERO) < 0) {
            throw AppException.badRequest("Pitch không được âm.");
        }
    }

    private static String normalizeColor(String colorHex) {
        if (colorHex == null || colorHex.isBlank()) {
            return null;
        }
        String c = colorHex.trim();
        return c.startsWith("#") ? c : "#" + c;
    }
}
