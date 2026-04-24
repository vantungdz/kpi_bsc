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
    private String target;
    private String actual;
    private String status;
    private String blockerSummary;
    private List<GmDiagMemberNode> members;
}
