import apiClient from "@/core/services/api";

const state = {
  evaluations: [],
  loading: false,
  error: null,
};

const getters = {
  allEvaluations: (state) => state.evaluations,
  isLoading: (state) => state.loading,
  error: (state) => state.error,
};

const mutations = {
  SET_LOADING(state, isLoading) {
    state.loading = isLoading;
  },
  SET_ERROR(state, error) {
    state.error = error
      ? error.response?.data?.message || error.message || "An unknown error occurred"
      : null;
  },
  SET_EVALUATIONS(state, evaluations) {
    state.evaluations = evaluations;
  },
};

const actions = {
  async fetchEvaluations({ commit }) {
    commit("SET_LOADING", true);
    try {
      const response = await apiClient.get("/kpi-evaluations");
      commit("SET_EVALUATIONS", response.data || []);
      commit("SET_ERROR", null); // Clear previous error on success
    } catch (error) {
      commit("SET_ERROR", error);
      commit("SET_EVALUATIONS", []); // Reset data on error
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
