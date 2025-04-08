// store/modules/kpi-values.js
import apiClient from '../../services/api';

export default {
  namespaced: true,
  state: {
    kpis: [],
    currentKpi: null,
  },
  getters: {
    getUpdatedKpi: (state) => state.kpis.currentKpi,
  },
  actions: {

    async updateKpiValue({ commit }, { id, updatedKpi }) {
      try {
        const response = await apiClient.patch(`/kpi-values/${id}`, updatedKpi);
        commit('updateKpiValue', response.data);
        return true;  
      } catch (error) {
        console.error('Failed to update KPI:', error);
        return false;  
      }
    },
  },

  mutations: {
    updateKpiValue(state, updatedKpi) {
      const index = state.kpis.findIndex(kpi => kpi.id === updatedKpi.id);
      if (index !== -1) {
        state.kpis[index] = updatedKpi;
      }
    },
  },
};
