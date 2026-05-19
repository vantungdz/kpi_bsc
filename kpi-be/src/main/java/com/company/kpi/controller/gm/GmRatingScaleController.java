package com.company.kpi.controller.gm;

import com.company.kpi.common.dto.BaseResponse;
import com.company.kpi.controller.base.BaseController;
import com.company.kpi.request.gm.CreateGmRatingScaleRequest;
import com.company.kpi.request.gm.PatchGmRatingScaleCycleStatusRequest;
import com.company.kpi.request.gm.SaveGmRatingScaleLevelRequest;
import com.company.kpi.response.gm.GmRatingScaleCycleStatusResponse;
import com.company.kpi.response.gm.GmRatingScaleDetailResponse;
import com.company.kpi.response.gm.GmRatingScaleLevelResponse;
import com.company.kpi.response.gm.GmRatingScaleSummaryResponse;
import com.company.kpi.service.gm.GmRatingScaleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * GM — quản lý khung điểm đánh giá theo chu kỳ KPI (kpi_cycles).
 *
 * <ul>
 *   <li>GET  /api/v1/kpi/gm/rating-scales</li>
 *   <li>GET  /api/v1/kpi/gm/rating-scales/years/{year}</li>
 *   <li>PATCH /api/v1/kpi/gm/rating-scales/cycles/{cycleId}/status</li>
 *   <li>POST /api/v1/kpi/gm/rating-scales</li>
 *   <li>POST /api/v1/kpi/gm/rating-scales/cycles/{cycleId}/levels</li>
 *   <li>PUT  /api/v1/kpi/gm/rating-scales/cycles/{cycleId}/levels/{levelId}</li>
 *   <li>DELETE /api/v1/kpi/gm/rating-scales/cycles/{cycleId}/levels/{levelId}</li>
 * </ul>
 */
@RestController
@RequestMapping("/v1/kpi/gm/rating-scales")
@RequiredArgsConstructor
@PreAuthorize("hasRole('GM')")
public class GmRatingScaleController extends BaseController {

    private final GmRatingScaleService gmRatingScaleService;

    @GetMapping
    public ResponseEntity<BaseResponse<List<GmRatingScaleSummaryResponse>>> listScales() {
        return success(gmRatingScaleService.listScales());
    }

    @GetMapping("/years/{year}")
    public ResponseEntity<BaseResponse<GmRatingScaleDetailResponse>> getByYear(
            @PathVariable int year) {
        return success(gmRatingScaleService.getByYear(year));
    }

    @PatchMapping("/cycles/{cycleId}/status")
    public ResponseEntity<BaseResponse<GmRatingScaleCycleStatusResponse>> patchCycleStatus(
            @PathVariable UUID cycleId,
            @Valid @RequestBody PatchGmRatingScaleCycleStatusRequest req,
            Authentication auth) {
        UUID actorId = UUID.fromString((String) auth.getPrincipal());
        return success(
                gmRatingScaleService.updateCycleStatus(cycleId, req.getStatusCode(), actorId));
    }

    @PostMapping
    public ResponseEntity<BaseResponse<GmRatingScaleDetailResponse>> createScale(
            @Valid @RequestBody CreateGmRatingScaleRequest req,
            Authentication auth) {
        UUID actorId = UUID.fromString((String) auth.getPrincipal());
        return created(gmRatingScaleService.createScale(req, actorId));
    }

    @PostMapping("/cycles/{cycleId}/levels")
    public ResponseEntity<BaseResponse<GmRatingScaleLevelResponse>> addLevel(
            @PathVariable UUID cycleId,
            @Valid @RequestBody SaveGmRatingScaleLevelRequest req,
            Authentication auth) {
        UUID actorId = UUID.fromString((String) auth.getPrincipal());
        return created(gmRatingScaleService.addLevel(cycleId, req, actorId));
    }

    @PutMapping("/cycles/{cycleId}/levels/{levelId}")
    public ResponseEntity<BaseResponse<GmRatingScaleLevelResponse>> updateLevel(
            @PathVariable UUID cycleId,
            @PathVariable UUID levelId,
            @Valid @RequestBody SaveGmRatingScaleLevelRequest req,
            Authentication auth) {
        UUID actorId = UUID.fromString((String) auth.getPrincipal());
        return success(gmRatingScaleService.updateLevel(cycleId, levelId, req, actorId));
    }

    @DeleteMapping("/cycles/{cycleId}/levels/{levelId}")
    public ResponseEntity<BaseResponse<Void>> deleteLevel(
            @PathVariable UUID cycleId,
            @PathVariable UUID levelId,
            Authentication auth) {
        UUID actorId = UUID.fromString((String) auth.getPrincipal());
        gmRatingScaleService.deleteLevel(cycleId, levelId, actorId);
        return success(null);
    }
}
