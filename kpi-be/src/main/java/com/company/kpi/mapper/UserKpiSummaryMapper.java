package com.company.kpi.mapper;

import com.company.kpi.entity.UserKpiSummary;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.Optional;
import java.util.UUID;
@Mapper
public interface UserKpiSummaryMapper {

    Optional<UserKpiSummary> findByUserIdAndCycleId(UUID userId, UUID cycleId);

    int updateEvaluationSupervisorComments(
            @Param("userId") UUID userId,
            @Param("cycleId") UUID cycleId,
            @Param("comments") String comments,
            @Param("evaluatorId") UUID evaluatorId,
            @Param("updatedBy") UUID updatedBy);

    int insertEvaluationSupervisorComments(
            @Param("id") UUID id,
            @Param("userId") UUID userId,
            @Param("cycleId") UUID cycleId,
            @Param("comments") String comments,
            @Param("evaluatorId") UUID evaluatorId,
            @Param("createdBy") UUID createdBy,
            @Param("updatedBy") UUID updatedBy);
}
