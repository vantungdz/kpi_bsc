package com.company.kpi.aggregate;

import com.company.kpi.entity.User;
import com.company.kpi.entity.JobTitle;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@EqualsAndHashCode(callSuper = true)
public class UserTeamHierarchyAggregate extends User {
    // 1-1 mapping
    private JobTitle jobTitle;
    
    private UUID supervisorId;
    private BigDecimal selfScore;
    private BigDecimal pmScore;
    private String pmComment;
    private Integer minStatusCode;
    /** Có assignment trong kỳ đang chờ PM đánh giá (501 giữa kỳ / 601 cuối kỳ). */
    private Boolean requiresPmEvaluation;
}