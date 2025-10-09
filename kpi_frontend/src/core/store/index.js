import { createStore } from "vuex";
import kpis from "@/features/kpi/store/kpis";
import departments from "@/features/departments/store/departments";
import perspectives from "@/features/perspectives/store/perspectives";
import employees from "@/features/employees/store/employees";
import kpiValues from "@/features/kpi/store/kpiValues";
import sections from "@/features/sections/store/sections";
import auth from "@/features/auth/store/auth";
import notifications from "@/features/notifications/store/notifications";
import dashboard from "@/features/dashboard/store/dashboard";
import reports from "@/features/reports/store/report";
import myKpiReviews from "@/features/evaluation/store/myKpiReviews";
import roles from "@/features/roles/store/roles";
import loading from "@/store/loading";
import formula from "@/features/formula/store/fomula";
import strategicObjectives from "@/features/strategic-objectives/store/storeStrategicObjectives";
import auditLog from "@/features/dashboard/store/auditLog";
import competency from "@/features/competency/store/competency";
import employeeSkill from "@/features/competency/store/employeeSkill";
import personalGoal from "@/features/personal-goal/store/personalGoal";
import documents from "@/features/documents/store/documents";

const store = createStore({
  modules: {
    loading,
    auth,
    dashboard,
    auditLog,
    notifications,
    kpis,
    departments,
    sections,
    perspectives,
    employees,
    kpiValues,
    reports,
    myKpiReviews,
    roles,
    formula,
    strategicObjectives,
    competency,
    employeeSkill,
    personalGoal,
    documents,
  },
});

export default store;
