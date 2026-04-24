package com.company.kpi.aggregate;

import com.company.kpi.entity.User;
import lombok.Data;

@Data
public class PmMemberOptionAggregate extends User {
    private String departmentName;
    private String jobTitleName;
    private String rankCode;
}
