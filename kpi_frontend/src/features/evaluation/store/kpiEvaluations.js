import apiClient from "@/core/services/api";
import { notification } from "ant-design-vue";

const state = {
  reviewableTargets: [],
  loadingReviewableTargets: false,
  reviewableTargetsError: null,

  reviewCycles: [],
  loadingReviewCycles: false,
  reviewCyclesError: null,

  kpisToReview: [],
  loadingKpisToReview: false,
  kpisToReviewError: null,

  isSubmittingReview: false,
  submitReviewError: null,
};

const getters = {
  getReviewableTargets: (state) => state.reviewableTargets,
  isLoadingReviewableTargets: (state) => state.loadingReviewableTargets,
  getReviewableTargetsError: (state) => state.reviewableTargetsError,

  getReviewCycles: (state) => state.reviewCycles,
  isLoadingReviewCycles: (state) => state.loadingReviewCycles,
  getReviewCyclesError: (state) => state.reviewCyclesError,

  getKpisToReview: (state) => state.kpisToReview,
  isLoadingKpisToReview: (state) => state.loadingKpisToReview,
  getKpisToReviewError: (state) => state.kpisToReviewError,

  isSubmittingKpiReview: (state) => state.isSubmittingReview,
  getSubmitKpiReviewError: (state) => state.submitReviewError,
};

const actions = {
  async fetchReviewableTargets({ commit }) {
    commit("SET_LOADING_REVIEWABLE_TARGETS", true);
    commit("SET_REVIEWABLE_TARGETS_ERROR", null);
    try {
      const response = await apiClient.get("/evaluation/reviewable-targets");
      commit("SET_REVIEWABLE_TARGETS", response.data || []);
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || "Failed to fetch reviewable targets.";
      commit("SET_REVIEWABLE_TARGETS_ERROR", errorMsg);
      notification.error({ message: "Lỗi tải đối tượng review", description: errorMsg });
      return null;
    } finally {
      commit("SET_LOADING_REVIEWABLE_TARGETS", false);
    }
  },

  async fetchReviewCycles({ commit }) {
    commit("SET_LOADING_REVIEW_CYCLES", true);
    commit("SET_REVIEW_CYCLES_ERROR", null);
    try {
      const response = await apiClient.get("/evaluation/review-cycles");
      commit("SET_REVIEW_CYCLES", response.data || []);
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || "Failed to fetch review cycles.";
      commit("SET_REVIEW_CYCLES_ERROR", errorMsg);
      notification.error({ message: "Lỗi tải chu kỳ review", description: errorMsg });
      return null;
    } finally {
      commit("SET_LOADING_REVIEW_CYCLES", false);
    }
  },

  async fetchKpisForReview({ commit }, { targetId, targetType, cycleId }) {
    commit("SET_LOADING_KPIS_TO_REVIEW", true);
    commit("SET_KPIS_TO_REVIEW_ERROR", null);
    commit("SET_KPIS_TO_REVIEW", []); // Reset
    try {
      const response = await apiClient.get("/evaluation/kpis-for-review", {
        params: { targetId, targetType, cycleId },
      });
      // Map data to include managerComment and managerScore for form binding
      const kpis = (response.data || []).map(kpi => ({
        ...kpi,
        managerComment: kpi.existingManagerComment || '',
        managerScore: kpi.existingManagerScore || null,
      }));
      commit("SET_KPIS_TO_REVIEW", kpis);
      return kpis;
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || "Failed to fetch KPIs for review.";
      commit("SET_KPIS_TO_REVIEW_ERROR", errorMsg);
      notification.error({ message: "Lỗi tải KPI để review", description: errorMsg });
      return null;
    } finally {
      commit("SET_LOADING_KPIS_TO_REVIEW", false);
    }
  },

  async submitKpiReview({ commit }, reviewData) {
    commit("SET_IS_SUBMITTING_REVIEW", true);
    commit("SET_SUBMIT_REVIEW_ERROR", null);
    try {
      await apiClient.post("/evaluation/submit-review", reviewData);
      // No data to commit to state on success, just handle loading/error
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || "Failed to submit KPI review.";
      commit("SET_SUBMIT_REVIEW_ERROR", errorMsg);
      throw error; // Re-throw to be caught in component
    } finally {
      commit("SET_IS_SUBMITTING_REVIEW", false);
    }
  },
};

const mutations = {
  SET_REVIEWABLE_TARGETS(state, targets) {
    state.reviewableTargets = targets;
  },
  SET_LOADING_REVIEWABLE_TARGETS(state, isLoading) {
    state.loadingReviewableTargets = isLoading;
  },
  SET_REVIEWABLE_TARGETS_ERROR(state, error) {
    state.reviewableTargetsError = error;
  },

  SET_REVIEW_CYCLES(state, cycles) {
    state.reviewCycles = cycles;
  },
  SET_LOADING_REVIEW_CYCLES(state, isLoading) {
    state.loadingReviewCycles = isLoading;
  },
  SET_REVIEW_CYCLES_ERROR(state, error) {
    state.reviewCyclesError = error;
  },

  SET_KPIS_TO_REVIEW(state, kpis) {
    state.kpisToReview = kpis;
  },
  SET_LOADING_KPIS_TO_REVIEW(state, isLoading) {
    state.loadingKpisToReview = isLoading;
  },
  SET_KPIS_TO_REVIEW_ERROR(state, error) {
    state.kpisToReviewError = error;
  },

  SET_IS_SUBMITTING_REVIEW(state, isSubmitting) {
    state.isSubmittingReview = isSubmitting;
  },
  SET_SUBMIT_REVIEW_ERROR(state, error) {
    state.submitReviewError = error;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};