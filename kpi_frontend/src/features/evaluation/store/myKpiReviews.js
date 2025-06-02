import apiClient from "@/core/services/api";
import store from "@/core/store";

const state = {
  myKpiReviews: [],
  error: null,
};

const getters = {
  myKpiReviews: (state) => state.myKpiReviews,
  myKpiReviewsError: (state) => state.error,
};

const actions = {
  async fetchMyKpiReviews({ commit }, cycleId) {
    await store.dispatch("loading/startLoading");
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
      await store.dispatch("loading/stopLoading");
    }
  },
};

const mutations = {
  SET_MY_KPI_REVIEWS(state, data) {
    state.myKpiReviews = data;
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
