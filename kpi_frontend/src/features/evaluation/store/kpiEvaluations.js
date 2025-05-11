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
  existingOverallReview: null, // Thêm state cho đánh giá tổng thể đã có
  // existingOverallReviewError: null, // Tùy chọn: lỗi riêng cho overall review

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
  getExistingOverallReview: (state) => state.existingOverallReview, // Thêm getter
  // getExistingOverallReviewError: (state) => state.existingOverallReviewError, // Tùy chọn

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
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch reviewable targets.";
      commit("SET_REVIEWABLE_TARGETS_ERROR", errorMsg);
      notification.error({
        message: "Lỗi tải đối tượng review",
        description: errorMsg,
      });
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
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch review cycles.";
      commit("SET_REVIEW_CYCLES_ERROR", errorMsg);
      notification.error({
        message: "Lỗi tải chu kỳ review",
        description: errorMsg,
      });
      return null;
    } finally {
      commit("SET_LOADING_REVIEW_CYCLES", false);
    }
  },

  async fetchKpisForReview({ commit }, { targetId, targetType, cycleId }) {
    commit("SET_LOADING_KPIS_TO_REVIEW", true);
    commit("SET_KPIS_TO_REVIEW_ERROR", null);
    commit("SET_KPIS_TO_REVIEW", []); // Reset
    console.log(
      "[Vuex kpiEvaluations/fetchKpisForReview] Fetching with params:",
      {
        targetId,
        targetType,
        cycleId,
      }
    );
    commit("SET_EXISTING_OVERALL_REVIEW", null); // Reset overall review
    try {
      const response = await apiClient.get("/evaluation/kpis-for-review", {
        params: { targetId, targetType, cycleId },
      });

      console.log(
        "[Vuex kpiEvaluations/fetchKpisForReview] API Response Data:",
        response.data
      );
      if (response.data && typeof response.data === "object") {
        const kpisData = response.data.kpisToReview;
        const overallReviewData = response.data.existingOverallReview;

        if (Array.isArray(kpisData)) {
          // Map data to include managerComment and managerScore for form binding
          const kpisMapped = kpisData.map((kpi) => ({
            ...kpi,
            managerComment: kpi.existingManagerComment || "",
            managerScore:
              kpi.existingManagerScore === undefined
                ? null
                : kpi.existingManagerScore,
          }));
          commit("SET_KPIS_TO_REVIEW", kpisMapped);
        } else {
          commit("SET_KPIS_TO_REVIEW", []);
          console.warn(
            "[Vuex kpiEvaluations/fetchKpisForReview] response.data.kpisToReview is not an array:",
            kpisData
          );
        }

        commit("SET_EXISTING_OVERALL_REVIEW", overallReviewData || null);
        return response.data; // Trả về toàn bộ object response nếu component cần
      } else {
        console.error(
          "[Vuex kpiEvaluations/fetchKpisForReview] Invalid response data structure:",
          response.data
        );
        commit("SET_KPIS_TO_REVIEW_ERROR", "Dữ liệu trả về không hợp lệ.");
        // Đảm bảo reset state
        commit("SET_KPIS_TO_REVIEW", []);
        commit("SET_EXISTING_OVERALL_REVIEW", null);
        return null;
      }
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch KPIs for review.";
      commit("SET_KPIS_TO_REVIEW_ERROR", errorMsg);
      notification.error({
        message: "Lỗi tải KPI để review",
        description: errorMsg,
      });
      // Đảm bảo reset state khi có lỗi
      commit("SET_KPIS_TO_REVIEW", []);
      commit("SET_EXISTING_OVERALL_REVIEW", null);
      return null; // Hoặc throw error tùy theo cách bạn muốn xử lý ở component
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
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to submit KPI review.";
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

  SET_EXISTING_OVERALL_REVIEW(state, overallReview) {
    // Thêm mutation
    state.existingOverallReview = overallReview;
  },
  // SET_EXISTING_OVERALL_REVIEW_ERROR(state, error) { // Tùy chọn
  //   state.existingOverallReviewError = error;
  // },

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
