import { createStore } from 'vuex';
import kpis from './modules/kpis';
import users from './modules/users';
import perspectives from './modules/perspectives';
import kpiEvaluations from './modules/kpiEvaluations';

const store = createStore({
  modules: {
    kpis,
    users,
    perspectives,
    kpiEvaluations
  },
});

export default store;
