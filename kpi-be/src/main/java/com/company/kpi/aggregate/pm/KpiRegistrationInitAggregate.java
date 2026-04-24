package com.company.kpi.aggregate.pm;

import com.company.kpi.entity.KpiCycle;
import com.company.kpi.entity.KpiMaster;
import com.company.kpi.entity.SysStatusCode;
import lombok.Data;
import java.util.List;

@Data
public class KpiRegistrationInitAggregate {
    private KpiCycle currentCycle;
    private List<KpiMaster> availableKpis;
    private List<SysStatusCode> kpiTypes;
    private List<SysStatusCode> calculationRules;
}