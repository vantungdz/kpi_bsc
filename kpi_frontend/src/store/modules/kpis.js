// store/modules/kpi.js
import apiClient from '../../services/api';

export default {
  state: {
    kpis: [],
    currentKpi: null,
  },
  getters: {
    allKpis: (state) => state.kpis,
    getKpiById: (state) => (id) => state.kpis.find(kpi => kpi.id === id),
    currentKpi: (state) => state.kpis.currentKpi,
  },
  actions: {
    async fetchKpis({ commit }) {
      try {
        const response = await apiClient.get('/kpis');
        commit('setKpis', response.data);
      } catch (error) {
        console.error("Failed to fetch KPIs:", error);
      }
    },

    async fetchKpiById({ commit }, kpiId) {
      try {
        const response = await apiClient.get(`/kpis/${kpiId}`);
        console.log('Response from API:', response.data); // Log dữ liệu nhận được từ API
        if (response.data) {
          commit('setCurrentKpi', response.data); // Cập nhật store với dữ liệu nhận được
        } else {
          console.error('No data received from API');
        }
      } catch (error) {
        console.error('Error fetching KPI by ID:', error);
      }
    },

    async createKpi({ commit }, newKpi) {
      try {
        const response = await apiClient.post('/kpis', newKpi);
        commit('addKpi', response.data);
        return response.data;
      } catch (error) {
        console.error('Failed to create KPI:', error);
        throw error;
      }
    },

    async deleteKpi({ commit }, id) {
      try {
        await apiClient.delete(`/kpis/${id}`);
        commit('deleteKpi', id);
        return true;
      } catch (error) {
        console.error('Failed to delete KPI:', error);
        return false;
      }
    },

    async updateKpi({ commit },id, updatedKpi) {
      try {
        const response = await apiClient.patch(`/kpis/${id}`, updatedKpi);
        commit('updateKpi', response.data);
        return true;
      } catch (error) {
        console.error('Failed to update KPI:', error);
        return false;
      }
    },

    
  },
  mutations: {
    setKpis(state, kpis) {
      state.kpis = kpis;
    },
    
    setCurrentKpi(state, kpi) {
      state.kpis.currentKpi = kpi;  // Đảm bảo rằng bạn đang cập nhật đúng state
    },

    addKpi(state, newKpi) {
      state.kpis.push(newKpi);
    },

    updateKpi(state, updatedKpi) {
      const index = state.kpis.findIndex(kpi => kpi.id === updatedKpi.id);
      if (index !== -1) {
        state.kpis[index] = updatedKpi;
      }
    },

    deleteKpi(state, id) {
      state.kpis = state.kpis.filter(kpi => kpi.id !== id);
    },
  },
};
