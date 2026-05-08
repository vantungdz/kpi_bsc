package com.company.kpi.service.common;

import com.company.kpi.common.constant.Constant;
import com.company.kpi.common.exception.AppException;
import com.company.kpi.entity.KpiCycle;
import com.company.kpi.mapper.KpiCycleMapper;
import com.company.kpi.response.common.KpiCycleResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class KpiCycleService {

    private final KpiCycleMapper kpiCycleMapper;
    private final ModelMapper modelMapper;

    public KpiCycleResponse getKpiCycleByYear(Integer year) {
        Optional<KpiCycle> optionalKpiCycle = kpiCycleMapper.findByYear(year);

        if (optionalKpiCycle.isEmpty()) {
            log.warn("KPI Cycle not found for year: {}", year);
            throw AppException.notFound("KPI Cycle not found for year: " + year);
        }

        KpiCycle kpiCycle = optionalKpiCycle.get();
        KpiCycleResponse response = modelMapper.map(kpiCycle, KpiCycleResponse.class);
        String activePhase = calculateActivePhase(
                kpiCycle.getGoalSettingStart(),
                kpiCycle.getGoalSettingEnd(),
                kpiCycle.getMidYearStart(),
                kpiCycle.getMidYearEnd(),
                kpiCycle.getEndYearStart(),
                kpiCycle.getEndYearEnd()
        );
        response.setActivePhase(activePhase);

        return response;
    }

    /**
     * Xác định phase đang active dựa trên 6 mốc thời gian thực từ bảng kpi_cycles.
     * <p>
     * Ưu tiên: kiểm tra từng cửa sổ [start, end]. Nếu now nằm trong cửa sổ → phase đó active.
     * Nếu now nằm giữa 2 phase → lấy phase tiếp theo chưa bắt đầu (upcoming next), 
     * nhưng hiển thị phase trước đó là complete.
     * Thực tế UI sẽ dùng: setting=complete, mid=active theo flag "mid_year" dù chưa tới midYearStart.
     * </p>
     */
    private String calculateActivePhase(
            OffsetDateTime goalStart, OffsetDateTime goalEnd,
            OffsetDateTime midStart, OffsetDateTime midEnd,
            OffsetDateTime endStart, OffsetDateTime endEnd) {

        OffsetDateTime now = OffsetDateTime.now();

        // Đang trong cửa sổ Year-End
        if (isWithinWindow(now, endStart, endEnd)) {
            return Constant.END_YEAR_PHASE;
        }
        // Đang trong cửa sổ Mid-Year
        if (isWithinWindow(now, midStart, midEnd)) {
            return Constant.MID_YEAR_PHASE;
        }
        // Đang trong cửa sổ Goal Setting
        if (isWithinWindow(now, goalStart, goalEnd)) {
            return Constant.TARGET_SETUP_PHASE;
        }

        // Nằm ngoài tất cả cửa sổ → xác định bằng deadline gần nhất đã qua
        if (endEnd != null && now.isAfter(endEnd)) {
            // Sau khi Year-End kết thúc → vẫn giữ year_end
            return Constant.END_YEAR_PHASE;
        }
        if (midEnd != null && now.isAfter(midEnd)) {
            // Giữa midYearEnd và endYearStart → chuẩn bị Year-End
            return Constant.END_YEAR_PHASE;
        }
        if (goalEnd != null && now.isAfter(goalEnd)) {
            // Giữa goalSettingEnd và midYearStart → chuẩn bị Mid-Year
            return Constant.MID_YEAR_PHASE;
        }

        // Trước goalSettingStart hoặc không có dữ liệu
        return Constant.TARGET_SETUP_PHASE;
    }

    /** Kiểm tra `now` nằm trong [start, end] (cả 2 đầu inclusive). */
    private boolean isWithinWindow(OffsetDateTime now, OffsetDateTime start, OffsetDateTime end) {
        if (start == null || end == null) return false;
        return !now.isBefore(start) && !now.isAfter(end);
    }
}