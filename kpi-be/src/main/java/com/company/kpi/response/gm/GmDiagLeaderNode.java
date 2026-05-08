package com.company.kpi.response.gm;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class GmDiagLeaderNode {
    private String id;
    private String name;
    /** Mã role hiển thị tag (từ DB supervisor hoặc manager khi nhóm trực tiếp). */
    private String ownerRoleCode;
    /** {@code roles.name} của supervisor nhóm — nhãn tag. */
    private String ownerRoleLabel;
    /** Cùng nhãn trọng số KPI như dòng KPI cha. */
    private String weight;
    private String target;
    /** So nhãn target nhóm leader với tổng target member trong nhóm. */
    private String targetBalance;
    private String actual;
    private String status;
    private String blockerSummary;
    /** KPI của chính supervisor (assignee trùng tên nhóm leader); không nằm trong {@link #members}. */
    private GmDiagMemberNode leaderOwnRow;
    private List<GmDiagMemberNode> members;
}
