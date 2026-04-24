package com.company.kpi.response.gm;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class GmDiagMemberNode {
    private String id;
    private String name;
    private String target;
    private String actual;
    private String status;
    /** Nhãn hiển thị cột trạng thái (tiếng Việt); null nếu chưa đủ dữ liệu điểm. */
    private String performanceLabel;
    private String blocker;
    private String rank;
    private String leader;
    /** {@code roles.code} của assignee (ưu tiên GM → PM → LEADER → MEMBER). */
    private String ownerRoleCode;
    /** {@code roles.name} của assignee — nhãn tag. */
    private String ownerRoleLabel;
    /** {@code roles.code} của supervisor (assignee); null nếu không có supervisor / không map được. */
    private String leaderRoleCode;
    /** {@code roles.name} của supervisor. */
    private String leaderRoleName;
}
