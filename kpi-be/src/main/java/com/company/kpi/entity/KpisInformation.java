package com.company.kpi.entity;

import lombok.Data;
import java.math.BigDecimal;
import java.util.UUID;

import com.company.kpi.entity.base.BaseEntity;

@Data
public class KpisInformation extends BaseEntity {
    private UUID cycleId;
    private UUID masterKpiId;
    private String targetDescription;
    private BigDecimal targetValue;
    private BigDecimal weight;
    private Boolean isImportant;
    /** Cho phép người nhận assignment sửa target và thang điểm trên dòng của họ. */
    private Boolean allowAssigneeTargetScaleEdit;
}