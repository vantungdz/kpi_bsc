package com.company.kpi.aggregate;

import com.company.kpi.entity.KpiAssignment;
import com.company.kpi.entity.KpiCategory;
import com.company.kpi.entity.KpiMaster;
import com.company.kpi.entity.KpisInformation;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class KpiAssignmentDetailAggregate extends KpiAssignment {
    private KpisInformation kpisInformation;
    private KpiMaster kpiMaster;
    private KpiCategory kpiCategory;
    private String unitName;
}
