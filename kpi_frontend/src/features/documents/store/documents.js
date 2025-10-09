import apiClient from '@/core/services/api';

const state = () => ({
  items: [],
  loading: false,
  error: null,
});

const mutations = {
  SET_ITEMS(state, docs) {
    state.items = docs;
  },
  SET_LOADING(state, loading) {
    state.loading = loading;
  },
  SET_ERROR(state, error) {
    state.error = error;
  },
};

const actions = {
  async fetchDocuments({ commit }) {
    commit('SET_LOADING', true);
    try {
      const res = await apiClient.get('/documents');
      commit('SET_ITEMS', res.data);
    } catch (err) {
      commit('SET_ERROR', err?.response?.data?.message || err.message);
    } finally {
      commit('SET_LOADING', false);
    }
  },
  async uploadDocument({ dispatch, commit }, formData) {
    commit('SET_LOADING', true);
    try {
      await apiClient.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      dispatch('fetchDocuments');
    } catch (err) {
      commit('SET_ERROR', err?.response?.data?.message || err.message);
    } finally {
      commit('SET_LOADING', false);
    }
  },
  async deleteDocument({ dispatch, commit }, id) {
    commit('SET_LOADING', true);
    try {
      await apiClient.delete(`/documents/${id}`);
      dispatch('fetchDocuments');
    } catch (err) {
      commit('SET_ERROR', err?.response?.data?.message || err.message);
    } finally {
      commit('SET_LOADING', false);
    }
  },
};

const getters = {
  documents: (state) => state.items,
  loading: (state) => state.loading,
  error: (state) => state.error,
};

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
};
