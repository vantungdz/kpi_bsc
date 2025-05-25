import apiClient from "@/core/services/api";

const state = {
  myKpiReviews: [],
  isLoading: false,
  error: null,
};

const getters = {
  myKpiReviews: (state) => state.myKpiReviews,
  isLoadingMyKpiReviews: (state) => state.isLoading,
  myKpiReviewsError: (state) => state.error,
};

const actions = {
  async fetchMyKpiReviews({ commit }, cycleId) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      const res = await apiClient.get("/kpi-review/my", {
        params: { cycle: cycleId },
      });
      commit("SET_MY_KPI_REVIEWS", res.data);
    } catch (e) {
      commit("SET_ERROR", e.message);
      commit("SET_MY_KPI_REVIEWS", []);
    } finally {
      commit("SET_LOADING", false);
    }
  },
};

const mutations = {
  SET_MY_KPI_REVIEWS(state, data) {
    state.myKpiReviews = data;
  },
  SET_LOADING(state, isLoading) {
    state.isLoading = isLoading;
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
