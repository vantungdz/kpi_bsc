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
    private BigDecimal score;
    private Integer statusCode;
    private boolean expanded = true;
    private int depth;
    private UUID supervisorId;
    private List<TeamMemberResponse> children = new ArrayList<>();
}