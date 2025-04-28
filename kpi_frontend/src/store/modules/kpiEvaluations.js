import apiClient from "../../services/api";

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
    state.error = error;
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
      commit("SET_EVALUATIONS", response.data);
    } catch (error) {
      commit("SET_ERROR", error);
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
