package com.company.kpi.response.gm;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class GmDiagPmNode {
    private String id;
    private String name;
    /** UUID manager phòng (section) — đồng bộ {@code GmDiagnosticsFlatRow.sectionManagerId}; FE dùng tránh lặp tên. */
    private String ownerUserId;
    /**
     * Mã vai trò rollup khối: {@code PM}, {@code LEADER}, {@code GM}, {@code MEMBER}, {@code TEAM} (102),
     * từ {@code user_roles}/{@code roles} của manager phòng — không gắn cứng trên UI.
     */
    private String ownerRoleCode;
    /** {@code roles.name} của manager phòng — nhãn hiển thị tag. */
    private String ownerRoleLabel;
    private String unitLine;
    /** Cùng nhãn trọng số KPI (`kpis_information.weight`) — diagnostics không chia nhỏ theo cây. */
    private String weight;
    private String target;
    /** So nhãn target khối với tổng assignment trong section: {@code short} | {@code ok} | {@code excess}. */
    private String targetBalance;
    private String actual;
    private String status;
    private String blockerSummary;
    private List<GmDiagMemberNode> members;
    private List<GmDiagLeaderNode> leaders;
}
