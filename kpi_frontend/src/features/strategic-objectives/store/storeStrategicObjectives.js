import apiClient from '@/core/services/api';

const state = {
  items: [],
  loading: false,
  error: null,
  current: null,
};

const getters = {
  getStrategicObjectives: (state) => state.items,
  getStrategicObjective: (state) => state.current,
  getStrategicObjectivesLoading: (state) => state.loading,
  getStrategicObjectivesError: (state) => state.error,
};

const actions = {
  async fetchStrategicObjectives({ commit }) {
    commit('SET_LOADING', true);
    commit('SET_ERROR', null);
    try {
      const res = await apiClient.get('/strategic-objectives');
      commit('SET_ITEMS', res.data);
    } catch (e) {
      commit('SET_ERROR', e.message);
    } finally {
      commit('SET_LOADING', false);
    }
  },
  async fetchStrategicObjective({ commit }, id) {
    commit('SET_LOADING', true);
    commit('SET_ERROR', null);
    try {
      const res = await apiClient.get(`/strategic-objectives/${id}`);
      commit('SET_CURRENT', res.data);
    } catch (e) {
      commit('SET_ERROR', e.message);
    } finally {
      commit('SET_LOADING', false);
    }
  },
  async createStrategicObjective({ dispatch }, data) {
    await apiClient.post('/strategic-objectives', data);
    await dispatch('fetchStrategicObjectives');
  },
  async updateStrategicObjective({ dispatch }, { id, data }) {
    await apiClient.patch(`/strategic-objectives/${id}`, data);
    await dispatch('fetchStrategicObjectives');
  },
  async deleteStrategicObjective({ dispatch }, id) {
    await apiClient.delete(`/strategic-objectives/${id}`);
    await dispatch('fetchStrategicObjectives');
  },
};

const mutations = {
  SET_ITEMS(state, data) {
    state.items = data;
  },
  SET_CURRENT(state, data) {
    state.current = data;
  },
  SET_LOADING(state, loading) {
    state.loading = loading;
  },
  SET_ERROR(state, error) {
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
