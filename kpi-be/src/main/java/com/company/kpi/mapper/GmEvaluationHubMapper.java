package com.company.kpi.mapper;

import com.company.kpi.aggregate.GmEvaluationHubAssignmentRow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.UUID;

@Mapper
public interface GmEvaluationHubMapper {

    List<GmEvaluationHubAssignmentRow> listAssignmentsForEvaluationHub(@Param("cycleId") UUID cycleId);
}
