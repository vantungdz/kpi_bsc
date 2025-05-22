import apiClient from "@/core/services/api";
import { hasPermission } from "@/core/utils/permission";
import { useStore } from "vuex";
import { computed } from "vue";

const state = {
  overallReview: null,
  kpiReviews: [],
  isLoadingReview: false,
  reviewError: null,
};

const getters = {
  getOverallReview: (state) => state.overallReview,
  getKpiReviews: (state) => state.kpiReviews,
  isLoadingReview: (state) => state.isLoadingReview,
  getReviewError: (state) => state.reviewError,
};

const store = useStore();
const user = computed(() => store.getters["auth/user"]);

const canViewReview = computed(() =>
  hasPermission(user.value, "view", "kpi_review")
);

const canSubmitReview = computed(() =>
  hasPermission(user.value, "approve", "kpi_review")
);

const canSelfReview = computed(() =>
  hasPermission(user.value, "view", "my_kpi_review")
);

const actions = {
  async fetchOverallReview({ commit }, { targetId, targetType, cycleId }) {
    if (!canViewReview.value) return;
    commit("SET_LOADING_REVIEW", true);
    commit("SET_REVIEW_ERROR", null);
    try {
      const res = await apiClient.get("/evaluation/overall-review", {
        params: { targetId, targetType, cycleId },
      });
      commit("SET_OVERALL_REVIEW", res.data);
      return res.data;
    } catch (e) {
      commit("SET_REVIEW_ERROR", e.message);
      throw e;
    } finally {
      commit("SET_LOADING_REVIEW", false);
    }
  },
  async fetchKpiReviews({ commit }, { targetId, targetType, cycleId }) {
    if (!canViewReview.value) return;
    commit("SET_LOADING_REVIEW", true);
    commit("SET_REVIEW_ERROR", null);
    try {
      const res = await apiClient.get("/evaluation/kpi-reviews", {
        params: { targetId, targetType, cycleId },
      });
      commit("SET_KPI_REVIEWS", res.data);
      return res.data;
    } catch (e) {
      commit("SET_REVIEW_ERROR", e.message);
      throw e;
    } finally {
      commit("SET_LOADING_REVIEW", false);
    }
  },
  async submitKpiReview({ dispatch }, payload) {
    if (!canSubmitReview.value) return;
    await apiClient.post("/evaluation/submit-review", payload);
    // Refresh data after submit
    await dispatch("fetchOverallReview", payload);
    await dispatch("fetchKpiReviews", payload);
  },
  async submitSelfKpiReview({ dispatch }, payload) {
    if (!canSelfReview.value) return;
    await apiClient.post("/evaluation/submit-self-review", payload);
    // Optionally refresh data
  },
  async submitEmployeeFeedback({ dispatch }, payload) {
    await apiClient.post("/evaluation/submit-employee-feedback", payload);
    // Optionally refresh data
  },
};

const mutations = {
  SET_OVERALL_REVIEW(state, data) {
    state.overallReview = data;
  },
  SET_KPI_REVIEWS(state, data) {
    state.kpiReviews = data;
  },
  SET_LOADING_REVIEW(state, isLoading) {
    state.isLoadingReview = isLoading;
  },
  SET_REVIEW_ERROR(state, error) {
    state.reviewError = error;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
