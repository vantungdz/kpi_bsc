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
        commit('SETKPIS_EVALUATIONS', response.data);
      } catch (error) {
        console.error("Failed to fetch KPIs:", error);
      }
    },

    async createKpi({ commit }, newEvaluations) {
      try {
        const response = await apiClient.post('/kpi-evaluations', newEvaluations);
        commit('ADD_EVALUATIONS', response.data);
        return response.data;
      } catch (error) {
        console.error('Failed to create KPI:', error);
        throw error;
      }
    },
    
  },
  mutations: {
    SETKPIS_EVALUATIONS(state, evaluations) {
      state.evaluationsList = evaluations;
    },

    ADD_EVALUATIONS(state, newKpi) {
      state.kpis.push(newKpi);
    },
  },
};
