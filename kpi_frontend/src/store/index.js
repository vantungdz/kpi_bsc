import { createStore } from "vuex";
import kpis from "./modules/kpis";
import departments from "./modules/departments";
import perspectives from "./modules/perspectives";
import users from "./modules/users";
import kpiEvaluations from "./modules/kpiEvaluations";
import kpiValues from "./modules/kpiValues";

const store = createStore({
  modules: {
    kpis,
    departments,
    perspectives,
    users,
    kpiEvaluations,
    kpiValues
  },
});

export default store;
