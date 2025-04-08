// store/modules/kpiEvaluations.js
import apiClient from '../../services/api';

export default {
  namespaced: true,
  state: {
    evaluations: [],
    currentKpi: null,
  },
  getters: {
    allEvaluations: (state) => state.evaluations,
    getEvaluationsByKpiId: (state) => (id) => state.evaluations.filter(ev => ev.kpi_id === id),
    currentEvaluations: (state) => state.currentKpi,
  },
  actions: {
    async fetchEvaluations({ commit }) {
      try {
        const response = await apiClient.get('/kpi-evaluations');
        commit('SETKPIS_EVALUATIONS', response.data);
      } catch (error) {
        console.error("Failed to fetch evaluations:", error);
      }
    },

    async createEvaluations({ commit }, newEvaluations) {
      try {
        const response = await apiClient.post('/kpi-evaluations', newEvaluations);
        commit('ADD_EVALUATIONS', response.data);
        return response.data;
      } catch (error) {
        console.error('Failed to create evaluation:', error);
        throw error;
      }
    },
    
  },
  mutations: {
    SETKPIS_EVALUATIONS(state, evaluations) {
      state.evaluations = evaluations;
    },
    ADD_EVALUATIONS(state, newEvaluation) {
      state.evaluations.push(newEvaluation);
    },
  },
};
