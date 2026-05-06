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
        /** Member đề xuất đã được PM duyệt — chờ GM. */
        public static final int WAITING_GM_APPROVAL = 403;
        public static final int PENDING_ACCEPTANCE = 404;
        /** Đã chốt mục tiêu (đang chạy) — ví dụ sau GM duyệt đề xuất KPI (403). */
        public static final int ACCEPTED = 405;
        public static final int REJECTED = 406;
        /** Đang chờ xử lý feedback giữa các cấp (PM↔GM / Member↔PM). */
        public static final int FEEDBACK_IN_PROGRESS = 407;
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
