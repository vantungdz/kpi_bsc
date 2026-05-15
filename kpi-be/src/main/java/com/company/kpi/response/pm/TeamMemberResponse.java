package com.company.kpi.response.pm;

import lombok.Data;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
public class TeamMemberResponse {
    private UUID id;
    private String name;
    private String role;
    private BigDecimal selfScore;
    private BigDecimal pmScore;
    private String pmComment;
    private Integer statusCode;
    /** true nếu có assignment trong kỳ đang ở cửa đánh giá PM (501 / 601). */
    private boolean requiresPmEvaluation;
    private BigDecimal portfolioSelfScore;
    private BigDecimal portfolioPmScore;
    private String portfolioPmComment;
    private Integer portfolioStatusCode;
    private boolean portfolioRequiresPmEvaluation;
    private BigDecimal promotionSelfScore;
    private BigDecimal promotionPmScore;
    private String promotionPmComment;
    private Integer promotionStatusCode;
    private boolean promotionRequiresPmEvaluation;
    private boolean expanded = true;
    private int depth;
    private UUID supervisorId;
    private List<TeamMemberResponse> children = new ArrayList<>();
}
