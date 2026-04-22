package com.company.kpi.common.constant;

import java.util.Map;

public class Constant {
    public static final String ROLE_MEMBER = "MEMBER";

    public static final String TARGET_SETUP_PHASE = "target_setup";
    public static final String MID_YEAR_PHASE = "mid_year";
    public static final String END_YEAR_PHASE = "year_end";

    public static final Map<String, String> PHASE_LABEL_MAP = Map.of(
            TARGET_SETUP_PHASE, "Giai đoạn Thiết lập mục tiêu",
            MID_YEAR_PHASE, "Giai đoạn Giữa năm",
            END_YEAR_PHASE, "Giai đoạn Cuối năm"
    );
}
