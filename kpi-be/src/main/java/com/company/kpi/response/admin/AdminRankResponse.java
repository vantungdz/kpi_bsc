package com.company.kpi.response.admin;

import lombok.Data;

/** DTO cấp bậc (rank) trả về cho Admin — dùng cho dropdown form */
@Data
public class AdminRankResponse {
    private String id;
    private String code;
    private String name;
}
