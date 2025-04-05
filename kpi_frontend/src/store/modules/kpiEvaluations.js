// store/modules/kpi.js
import apiClient from '../../services/api';

export default {
  state: {
    evaluations: [],
    currentKpi: null,
  },
  getters: {
    allEvaluations: (state) => state.evaluations,
    getEvaluationsById: (state) => (id) => state.evaluations.find(kpi => kpi.id === id),
    currentEvaluations: (state) => state.evaluations.currentKpi,
  },
  actions: {
    async fetchEvaluations({ commit }) {
      try {
        const response = await apiClient.get('/kpi-evaluations');
        commit('SETKPIS_EVALUATIONS', response.data.data || response.data);
      } catch (error) {
        console.error("Failed to fetch KPIs:", error);
      }
    },
    
  },
  mutations: {
    SETKPIS_EVALUATIONS(state, evaluations) {
      state.evaluations = evaluations;
    },
  },
};
