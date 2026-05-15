package com.company.kpi.entity;

import com.company.kpi.entity.base.BaseEntity;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
public class KpiAssignmentSnapshot extends BaseEntity {
    private UUID assignmentId;
    private UUID cycleId;
    private UUID userId;
    private UUID departmentId;
    private UUID jobTitleId;
    private UUID supervisorId;
    private String userFullName;
    private String userEmail;
    private String departmentName;
    private String jobTitleName;
    private String supervisorFullName;
    private String supervisorEmail;
}
