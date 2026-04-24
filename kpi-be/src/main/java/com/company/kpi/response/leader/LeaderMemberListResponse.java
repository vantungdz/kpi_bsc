package com.company.kpi.response.leader;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
public class LeaderMemberListResponse {

    private List<MemberInfo> members;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MemberInfo {
        private UUID memberId;
        private String fullName;
        private String email;
        private String jobTitle;
        private String jobLevel;
        private String rank;
        private BigDecimal score;
        private String status;
    }
}