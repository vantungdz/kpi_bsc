package com.company.kpi.request.pm;

import lombok.Data;
import java.math.BigDecimal;
import java.util.UUID;

@Data
public class KpiRegistrationRequest {
    // Nếu là KPI chọn từ thư viện
    private UUID existingMasterKpiId; 
    
    // Nếu là KPI tự đề xuất
    private String newKpiName;
    private Integer typeCode;
    private Integer calculationRuleCode;
    private Integer unitCode;
    
    // Thông tin giao việc (Assignment / Info)
    private BigDecimal targetValue;
    private BigDecimal weight;
    private String targetDescription;
    private Boolean isImportant;
}