package com.company.kpi.common;

public final class Constants {

    private Constants() {}

    public static final class CycleStatus {
        private CycleStatus() {}
        public static final int OPEN = 201;
        public static final int CLOSED = 202;
    }

    public static final class AssignStatus {
        private AssignStatus() {}
        public static final int WAITING_PM_APPROVAL = 402;
        public static final int PENDING_ACCEPTANCE = 404;
    }

    public static final class Category {
        private Category() {}
        public static final String KPI_TYPE = "KPI_TYPE";
        public static final String CALC_RULE = "CALC_RULE";
        public static final String KPI_UNIT = "KPI_UNIT";
        public static final String CALC_TYPE = "CALC_TYPE";
    }

    public static final class Error {
        private Error() {}
        public static final String NO_ACTIVE_CYCLE = "No active KPI cycle found.";
        public static final String USER_NOT_AUTHENTICATED = "User is not authenticated";
    }
}
