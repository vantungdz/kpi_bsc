import { createStore } from "vuex";
import kpis from "./modules/kpis";
import departments from "./modules/departments";
import perspectives from "./modules/perspectives";
import employees from "./modules/employees";
import kpiEvaluations from "./modules/kpiEvaluations";
import kpiValues from "./modules/kpiValues";
import sections from "./modules/sections";
import auth from "./modules/auth";

const store = createStore({
  modules: {
    auth,
    kpis,
    departments,
    sections,
    perspectives,
    employees,
    kpiEvaluations,
    "kpi-values": kpiValues,
  },
});

export default store;
