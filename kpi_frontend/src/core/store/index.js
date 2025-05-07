import { createStore } from "vuex";
import kpis from "../../features/kpi/store/kpis";
import departments from "../../features/organization/store/departments";
import perspectives from "../../features/kpi/store/perspectives";
import employees from "../../features/employees/store/employees"; 
import kpiEvaluations from "../../features/evaluation/store/kpiEvaluations";
import kpiValues from "../../features/kpi/store/kpiValues";
import sections from "../../features/organization/store/sections";
import auth from "../../features/auth/store/auth";
import notifications from "../../features/notifications/store/notifications"; // Import module mới

const store = createStore({
  modules: {
    auth,
    notifications,
    kpis,
    departments,
    sections,
    perspectives,
    employees,
    kpiEvaluations,
    kpiValues,
  },
});

export default store;
