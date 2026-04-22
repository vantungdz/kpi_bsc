package com.company.kpi.mapper;

import com.company.kpi.response.member.MemberKpiAssignmentDTO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.UUID;

@Mapper
public interface KpiAssignmentMapper {

    List<MemberKpiAssignmentDTO> findDetailsByUserAndCycle(
            @Param("userId") UUID userId,
            @Param("cycleId") UUID cycleId);

    Integer updateEvidence(
            @Param("id") UUID id,
            @Param("evidences") String evidences);
}
