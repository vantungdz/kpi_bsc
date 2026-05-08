package com.company.kpi.mapper;

import com.company.kpi.aggregate.report.GmReportAssignmentRow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * Mapper cho các API báo cáo GM.
 * Score columns sẽ được {@code SensitiveDataMybatisInterceptor} giải mã sau khi đọc.
 */
@Mapper
public interface GmReportMapper {

    /** Toàn bộ assignments thuộc nhiều năm — Service tự gom theo năm/level/section. */
    List<GmReportAssignmentRow> listAssignmentsByYears(@Param("years") List<Integer> years);

    /** Bottleneck dạng raw — cùng cycle, dùng cho Compliance report. */
    List<GmReportAssignmentRow> listBottleneckCandidates(@Param("year") Integer year);
}
