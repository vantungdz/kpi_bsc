import apiClient from '@/core/services/api';

const state = {
  items: [],
  loading: false,
  error: null,
  current: null,
};

const getters = {
  competencies: (state) => state.items,
  competency: (state) => state.current,
  loading: (state) => state.loading,
  error: (state) => state.error,
};

const actions = {
  async fetchCompetencies({ commit }) {
    commit('setLoading', true);
    try {
      const res = await apiClient.get('/competencies');
      commit('setItems', res.data);
    } catch (err) {
      commit('setError', err);
    } finally {
      commit('setLoading', false);
    }
  },
  async fetchCompetency({ commit }, id) {
    commit('setLoading', true);
    try {
      const res = await apiClient.get(`/competencies/${id}`);
      commit('setCurrent', res.data);
    } catch (err) {
      commit('setError', err);
    } finally {
      commit('setLoading', false);
    }
  },
  async createCompetency({ dispatch, commit }, data) {
    commit('setLoading', true);
    try {
      await apiClient.post('/competencies', data);
      dispatch('fetchCompetencies');
    } catch (err) {
      commit('setError', err);
    } finally {
      commit('setLoading', false);
    }
  },
  async updateCompetency({ dispatch, commit }, { id, data }) {
    commit('setLoading', true);
    try {
      await apiClient.patch(`/competencies/${id}`, data);
      dispatch('fetchCompetencies');
    } catch (err) {
      commit('setError', err);
    } finally {
      commit('setLoading', false);
    }
  },
  async deleteCompetency({ dispatch, commit }, id) {
    commit('setLoading', true);
    try {
      await apiClient.delete(`/competencies/${id}`);
      dispatch('fetchCompetencies');
    } catch (err) {
      commit('setError', err);
    } finally {
      commit('setLoading', false);
    }
  },
};

const mutations = {
  setItems(state, data) {
    state.items = data;
  },
  setCurrent(state, data) {
    state.current = data;
  },
  setLoading(state, loading) {
    state.loading = loading;
  },
  setError(state, error) {
    state.error = error?.response?.data?.message || error?.message || null;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
