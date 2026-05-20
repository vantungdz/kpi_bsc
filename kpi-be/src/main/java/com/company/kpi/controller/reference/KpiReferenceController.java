package com.company.kpi.controller.reference;

import com.company.kpi.common.dto.BaseResponse;
import com.company.kpi.controller.base.BaseController;
import com.company.kpi.response.reference.KpiCalculationReferenceResponse;
import com.company.kpi.response.reference.KpiTypeOptionResponse;
import com.company.kpi.response.reference.KpiUnitOptionResponse;
import com.company.kpi.response.reference.MemberByRankOptionResponse;
import com.company.kpi.response.reference.RankOptionResponse;
import com.company.kpi.response.reference.DepartmentManagerOptionResponse;
import com.company.kpi.service.reference.KpiReferenceDataService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Dữ liệu tham chiếu dùng chung (đã đăng nhập) — không gắn role GM/PM riêng.
 */
@RestController
@RequestMapping("/v1/kpi/reference")
@RequiredArgsConstructor
public class KpiReferenceController extends BaseController {

    private final KpiReferenceDataService kpiReferenceDataService;

    /** Đơn vị KPI từ {@code sys_status_codes} ({@code KPI_UNIT}). */
    @GetMapping("/kpi-units")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<BaseResponse<List<KpiUnitOptionResponse>>> listKpiUnits() {
        return success(kpiReferenceDataService.listKpiUnits());
    }

    /** Loại hình KPI ({@code KPI_TYPE}: 101 INDIVIDUAL, 102 TEAM, 103 PROMOTION) — form tạo strategic. */
    @GetMapping("/kpi-types-strategic")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<BaseResponse<List<KpiTypeOptionResponse>>> listStrategicKpiTypes() {
        return success(kpiReferenceDataService.listStrategicKpiTypes());
    }

    /** Danh sách {@code ranks} (code + name) — phân bổ KPI individual theo cấp bậc. */
    @GetMapping("/ranks")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<BaseResponse<List<RankOptionResponse>>> listRanks() {
        return success(kpiReferenceDataService.listRanks());
    }

    /** User có chức danh thuộc cấp bậc {@code rankCode} ({@code ranks.code}). */
    @GetMapping("/members-by-rank")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<BaseResponse<List<MemberByRankOptionResponse>>> listMembersByRank(
            @RequestParam(name = "rankCode") String rankCode) {
        return success(kpiReferenceDataService.listMembersByRankCode(rankCode));
    }

    /** User active kèm phòng ban chính + cấp bậc — form KPI Promotion «Assign To Individuals». */
    @GetMapping("/promotion-assignees")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<BaseResponse<List<MemberByRankOptionResponse>>> listPromotionAssignees() {
        return success(kpiReferenceDataService.listPromotionAssignees());
    }

    /** Mỗi {@code CALC_RULE} (dropdown) + các {@code CALC_TYPE} hợp lệ (radio); ánh xạ RULE→TYPE trong service. */
    @GetMapping("/calculation-reference")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<BaseResponse<KpiCalculationReferenceResponse>> listCalculationReference() {
        return success(kpiReferenceDataService.listCalculationReference());
    }

    /** User active có role PM — gán manager department, KPI cascading. */
    @GetMapping("/department-managers")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<BaseResponse<List<DepartmentManagerOptionResponse>>> listDepartmentManagers() {
        return success(kpiReferenceDataService.listDepartmentManagers());
    }
}
