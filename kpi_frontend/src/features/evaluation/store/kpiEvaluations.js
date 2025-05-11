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
  existingOverallReview: null,

  isSubmittingReview: false,
  submitReviewError: null,

  isCompletingReview: false,
  completeReviewError: null,

  employeeReviewDetails: null,
  isLoadingEmployeeReview: false,
  employeeReviewError: null,
  isSubmittingEmployeeFeedback: false,
  submitEmployeeFeedbackError: null,
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
  getExistingOverallReview: (state) => state.existingOverallReview,

  isSubmittingKpiReview: (state) => state.isSubmittingReview,
  getSubmitKpiReviewError: (state) => state.submitReviewError,

  isCompletingKpiReview: (state) => state.isCompletingReview,
  getCompleteKpiReviewError: (state) => state.completeReviewError,

  getEmployeeReviewDetails: (state) => state.employeeReviewDetails,
  isLoadingEmployeeReview: (state) => state.isLoadingEmployeeReview,
  getEmployeeReviewError: (state) => state.employeeReviewError,
  isSubmittingEmpFeedback: (state) => state.isSubmittingEmployeeFeedback,
  getSubmitEmpFeedbackError: (state) => state.submitEmployeeFeedbackError,
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
    commit("SET_KPIS_TO_REVIEW", []);
    console.log(
      "[Vuex kpiEvaluations/fetchKpisForReview] Fetching with params:",
      {
        targetId,
        targetType,
        cycleId,
      }
    );
    commit("SET_EXISTING_OVERALL_REVIEW", null);
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
        return response.data;
      } else {
        console.error(
          "[Vuex kpiEvaluations/fetchKpisForReview] Invalid response data structure:",
          response.data
        );
        commit("SET_KPIS_TO_REVIEW_ERROR", "Dữ liệu trả về không hợp lệ.");

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

      commit("SET_KPIS_TO_REVIEW", []);
      commit("SET_EXISTING_OVERALL_REVIEW", null);
      return null;
    } finally {
      commit("SET_LOADING_KPIS_TO_REVIEW", false);
    }
  },

  async submitKpiReview({ commit }, reviewData) {
    commit("SET_IS_SUBMITTING_REVIEW", true);
    commit("SET_SUBMIT_REVIEW_ERROR", null);
    try {
      const response = await apiClient.post(
        "/evaluation/submit-review",
        reviewData
      );

      if (response.data) {
        commit("SET_EXISTING_OVERALL_REVIEW", response.data);
      }
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to submit KPI review.";
      commit("SET_SUBMIT_REVIEW_ERROR", errorMsg);
      throw error;
    } finally {
      commit("SET_IS_SUBMITTING_REVIEW", false);
    }
  },

  async completeKpiReview({ commit }, completeReviewDto) {
    commit("SET_IS_COMPLETING_REVIEW", true);
    commit("SET_COMPLETE_REVIEW_ERROR", null);
    try {
      const response = await apiClient.post(
        "/evaluation/complete-review",
        completeReviewDto
      );

      if (response.data && response.data.updatedReview) {
        commit("SET_EXISTING_OVERALL_REVIEW", response.data.updatedReview);
      }
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to complete KPI review.";
      commit("SET_COMPLETE_REVIEW_ERROR", errorMsg);

      throw error;
    } finally {
      commit("SET_IS_COMPLETING_REVIEW", false);
    }
  },

  async fetchMyReviewDetails({ commit }, { cycleId }) {
    commit("SET_IS_LOADING_EMPLOYEE_REVIEW", true);
    commit("SET_EMPLOYEE_REVIEW_DETAILS", null);
    commit("SET_EMPLOYEE_REVIEW_ERROR", null);
    try {
      const response = await apiClient.get(`/evaluation/my-review/${cycleId}`);
      commit("SET_EMPLOYEE_REVIEW_DETAILS", response.data);
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch your review details.";
      commit("SET_EMPLOYEE_REVIEW_ERROR", errorMsg);
      notification.error({
        message: "Lỗi tải chi tiết đánh giá",
        description: errorMsg,
      });
      return null;
    } finally {
      commit("SET_IS_LOADING_EMPLOYEE_REVIEW", false);
    }
  },

  async submitEmployeeFeedback({ commit }, feedbackDto) {
    commit("SET_IS_SUBMITTING_EMPLOYEE_FEEDBACK", true);
    commit("SET_SUBMIT_EMPLOYEE_FEEDBACK_ERROR", null);
    try {
      const response = await apiClient.post(
        "/evaluation/my-review/submit-feedback",
        feedbackDto
      );

      if (response.data) {
        commit("UPDATE_EMPLOYEE_REVIEW_OVERALL_STATUS", response.data);
      }
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to submit your feedback.";
      commit("SET_SUBMIT_EMPLOYEE_FEEDBACK_ERROR", errorMsg);
      throw error;
    } finally {
      commit("SET_IS_SUBMITTING_EMPLOYEE_FEEDBACK", false);
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
    state.existingOverallReview = overallReview;
  },

  SET_IS_SUBMITTING_REVIEW(state, isSubmitting) {
    state.isSubmittingReview = isSubmitting;
  },
  SET_SUBMIT_REVIEW_ERROR(state, error) {
    state.submitReviewError = error;
  },

  SET_IS_COMPLETING_REVIEW(state, isCompleting) {
    state.isCompletingReview = isCompleting;
  },
  SET_COMPLETE_REVIEW_ERROR(state, error) {
    state.completeReviewError = error;
  },

  SET_EMPLOYEE_REVIEW_DETAILS(state, details) {
    state.employeeReviewDetails = details;
  },
  SET_IS_LOADING_EMPLOYEE_REVIEW(state, isLoading) {
    state.isLoadingEmployeeReview = isLoading;
  },
  SET_EMPLOYEE_REVIEW_ERROR(state, error) {
    state.employeeReviewError = error;
  },
  SET_IS_SUBMITTING_EMPLOYEE_FEEDBACK(state, isSubmitting) {
    state.isSubmittingEmployeeFeedback = isSubmitting;
  },
  SET_SUBMIT_EMPLOYEE_FEEDBACK_ERROR(state, error) {
    state.submitEmployeeFeedbackError = error;
  },
  UPDATE_EMPLOYEE_REVIEW_OVERALL_STATUS(state, updatedOverallReview) {
    if (
      state.employeeReviewDetails &&
      state.employeeReviewDetails.overallReviewByManager
    ) {
      state.employeeReviewDetails.overallReviewByManager = {
        ...state.employeeReviewDetails.overallReviewByManager,
        ...updatedOverallReview,
      };
    }
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
