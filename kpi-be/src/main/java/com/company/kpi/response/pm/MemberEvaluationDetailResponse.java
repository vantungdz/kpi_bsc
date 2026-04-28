package com.company.kpi.response.pm;
import lombok.Data;
import java.util.List;

@Data
public class MemberEvaluationDetailResponse {
    private String memberComment;
    private String pmComment;
    private List<MemberKpiDetailResponse> kpis;
}