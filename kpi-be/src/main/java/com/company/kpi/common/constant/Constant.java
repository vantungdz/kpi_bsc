package com.company.kpi.common.constant;

import java.util.Map;

public class Constant {
    // -----------------------------------------------
    // CONSTANT
    // -----------------------------------------------
    public static final String ROLE_GM = "GM";
    public static final String ROLE_MEMBER = "MEMBER";
    public static final String ROLE_LEADER = "LEADER";
    public static final String ROLE_PM = "PM";

    public static final String TARGET_SETUP_PHASE = "target_setup";
    public static final String MID_YEAR_PHASE = "mid_year";
    public static final String END_YEAR_PHASE = "year_end";

    public static final String KPI_TYPE = "KPI_TYPE";

    // -----------------------------------------------
    // MAPPING
    // -----------------------------------------------
    public static final Map<String, String> PHASE_LABEL_MAP = Map.of(
            TARGET_SETUP_PHASE, "Goal Setting Phase",
            MID_YEAR_PHASE, "Mid-Year Phase",
            END_YEAR_PHASE, "Year-End Phase"
    );

    // -----------------------------------------------
    // ENUM
    // -----------------------------------------------
    public enum KpiType {
        INDIVIDUAL,
        PROMOTION
    }

}
