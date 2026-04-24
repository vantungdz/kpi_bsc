package com.company.kpi.service.reference;

import com.company.kpi.mapper.RankMapper;
import com.company.kpi.mapper.SysStatusCodeMapper;
import com.company.kpi.mapper.UserMapper;
import com.company.kpi.response.reference.CalcRuleWithTypesResponse;
import com.company.kpi.response.reference.KpiCalculationReferenceResponse;
import com.company.kpi.response.reference.KpiTypeOptionResponse;
import com.company.kpi.response.reference.KpiUnitOptionResponse;
import com.company.kpi.response.reference.MemberByRankOptionResponse;
import com.company.kpi.response.reference.RankOptionResponse;
import com.company.kpi.response.reference.StatusCodeOptionResponse;
import com.company.kpi.response.reference.DepartmentManagerOptionResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class KpiReferenceDataService {

    private static final String CATEGORY_KPI_UNIT = "KPI_UNIT";
    private final SysStatusCodeMapper sysStatusCodeMapper;
    private final UserMapper userMapper;
    private final RankMapper rankMapper;

    public List<KpiUnitOptionResponse> listKpiUnits() {
        return sysStatusCodeMapper.listKpiUnits(CATEGORY_KPI_UNIT);
    }

    /** Cấp bậc ({@code ranks}) — form KPI individual «Assign To Ranks». */
    public List<RankOptionResponse> listRanks() {
        return rankMapper.listActiveRanksOrderedByCode();
    }

    /** Loại hình KPI strategic — {@code sys_status_codes} {@code KPI_TYPE} (101 INDIVIDUAL, 102 TEAM, 103 PROMOTION). */
    public List<KpiTypeOptionResponse> listStrategicKpiTypes() {
        return sysStatusCodeMapper.listStrategicKpiTypes();
    }

    /**
     * Form GM: mỗi CALC_RULE (dropdown) kèm các CALC_TYPE (radio) khi áp dụng.
     * Không dùng bảng phụ: ánh xạ RULE→TYPE cố định trong service; nhãn lấy từ {@code sys_status_codes}.
     */
    public KpiCalculationReferenceResponse listCalculationReference() {
        List<StatusCodeOptionResponse> rules = sysStatusCodeMapper.listCalcRuleOptions();
        Map<Integer, StatusCodeOptionResponse> typesByCode = sysStatusCodeMapper.listCalcTypeOptions().stream()
                .collect(Collectors.toMap(StatusCodeOptionResponse::getCode, t -> t, (a, b) -> a, LinkedHashMap::new));

        List<CalcRuleWithTypesResponse> out = new ArrayList<>();
        for (StatusCodeOptionResponse r : rules) {
            int ruleCode = r.getCode() != null ? r.getCode() : 0;
            out.add(CalcRuleWithTypesResponse.builder()
                    .code(r.getCode())
                    .formValue(r.getFormValue())
                    .label(r.getLabel())
                    .calcTypes(calcTypesForRuleCode(ruleCode, typesByCode))
                    .build());
        }
        return KpiCalculationReferenceResponse.builder().calcRulesWithTypes(out).build();
    }

    /** User active là {@code departments.manager_id} — form KPI cascading «Giao cho quản lý department». */
    public List<DepartmentManagerOptionResponse> listDepartmentManagers() {
        return userMapper.listActiveDepartmentManagers();
    }

    /** User active có chức danh thuộc {@code ranks.code} (vd. R3). */
    public List<MemberByRankOptionResponse> listMembersByRankCode(String rankCode) {
        if (rankCode == null || rankCode.isBlank()) {
            return List.of();
        }
        return userMapper.listActiveUsersByRankCode(rankCode.trim());
    }

    /** User active + phòng ban chính + rank (nếu có) — dropdown KPI Promotion. */
    public List<MemberByRankOptionResponse> listPromotionAssignees() {
        return userMapper.listActiveUsersForPromotionAssignment();
    }

    /** AVERAGE (802) → ACTUAL_OVER_PLAN / PLAN_OVER_ACTUAL; COMMENT (803) → MANUAL_RATING; còn lại không radio. */
    private static List<StatusCodeOptionResponse> calcTypesForRuleCode(
            int ruleCode,
            Map<Integer, StatusCodeOptionResponse> typesByCode) {
        int[] typeCodes = switch (ruleCode) {
            case 802 -> new int[] {701, 702};
            case 803 -> new int[] {703};
            default -> new int[0];
        };
        List<StatusCodeOptionResponse> list = new ArrayList<>();
        for (int c : typeCodes) {
            StatusCodeOptionResponse src = typesByCode.get(c);
            if (src == null) {
                continue;
            }
            StatusCodeOptionResponse copy = new StatusCodeOptionResponse();
            copy.setCode(src.getCode());
            copy.setFormValue(src.getFormValue());
            copy.setLabel(src.getLabel());
            list.add(copy);
        }
        return list;
    }
}
