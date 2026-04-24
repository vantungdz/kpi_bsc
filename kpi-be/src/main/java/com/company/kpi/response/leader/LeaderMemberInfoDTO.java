package com.company.kpi.response.leader;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LeaderMemberInfoDTO {
    private UUID memberId;
    private String fullName;
    private String email;
    private String jobTitle;
    private String jobLevel;
    private String rank;
}
