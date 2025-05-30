import apiClient from "@/core/services/api";

const state = {
  perspectives: [],
  loading: false,
  error: null,
};

const getters = {
  perspectiveList: (state) => state.perspectives,
  isLoading: (state) => state.loading,
  error: (state) => state.error,
};

const mutations = {
  SET_LOADING(state, isLoading) {
    state.loading = isLoading;
  },
  SET_ERROR(state, error) {
    state.error = error ? error.response?.data?.message || error.message : null;
  },
  SET_PERSPECTIVES(state, perspectives) {
    state.perspectives = perspectives;
  },
};

const actions = {
  async fetchPerspectives({ commit }, params = {}) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.get("/perspectives", { params });
      commit("SET_PERSPECTIVES", response.data);
    } catch (error) {
      commit("SET_ERROR", error);
      commit("SET_PERSPECTIVES", []);
    } finally {
      commit("SET_LOADING", false);
    }
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
