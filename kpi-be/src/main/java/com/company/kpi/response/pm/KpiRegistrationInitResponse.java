package com.company.kpi.response.pm;

import com.company.kpi.entity.KpiCategory;
import com.company.kpi.entity.KpiCycle;
import com.company.kpi.entity.KpiMaster;
import com.company.kpi.entity.SysStatusCode;
import lombok.Builder;
import lombok.Getter;
import java.util.List;
import java.util.UUID;

@Getter
@Builder
public class KpiRegistrationInitResponse {
    private KpiCycle activeCycle;
    private List<KpiMaster> kpiLibrary;
    private List<SysStatusCode> kpiTypes;
    private List<SysStatusCode> calcRules;
    private List<SysStatusCode> calcTypes;
    private List<SysStatusCode> units;
    private List<KpiCategory> categories;
    private List<PmMemberOptionResponse> teamMembers;
    
    @Getter
    @Builder
    public static class PmMemberOptionResponse {
        private UUID id;
        private String shortName;
        private String fullName;
        private String departmentName;
        private String rankCode;
        private boolean assigned;
    }
}