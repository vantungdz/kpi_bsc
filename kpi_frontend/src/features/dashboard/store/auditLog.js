// src/features/dashboard/store/auditLog.js
import apiClient from '@/core/services/api';

const state = {
  logs: [],
  loading: false,
  error: null,
};

const getters = {
  auditLogs: (state) => state.logs,
  auditLogLoading: (state) => state.loading,
  auditLogError: (state) => state.error,
};

const actions = {
  async fetchAuditLogs({ commit }, filters = {}) {
    commit('setLoading', true);
    commit('setError', null);
    try {
      const params = { ...filters };
      // Chỉ truyền fromDate/toDate nếu có giá trị
      if (!params.fromDate) delete params.fromDate;
      if (!params.toDate) delete params.toDate;
      const res = await apiClient.get('/audit-log', { params });
      commit('setLogs', res.data || []);
    } catch (err) {
      commit('setError', err.response?.data?.message || err.message);
      commit('setLogs', []);
    } finally {
      commit('setLoading', false);
    }
  },
};

const mutations = {
  setLogs(state, logs) {
    state.logs = logs;
  },
  setLoading(state, loading) {
    state.loading = loading;
  },
  setError(state, error) {
    state.error = error;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
