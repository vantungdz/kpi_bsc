package com.company.kpi.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.UUID;

@Mapper
public interface KpiAssignmentSnapshotMapper {
    int insertSnapshotForAssignment(
            @Param("assignmentId") UUID assignmentId,
            @Param("createdBy") UUID createdBy);

    int insertSnapshotsForAssignments(
            @Param("assignmentIds") List<UUID> assignmentIds,
            @Param("createdBy") UUID createdBy);
}
