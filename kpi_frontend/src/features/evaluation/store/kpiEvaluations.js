import apiClient from "@/core/services/api";
import { notification } from "ant-design-vue";

const state = {
  reviewableTargets: [],
  loadingReviewableTargets: false,
  currentPerformanceEvaluationStatus: null,
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

  reviewHistory: [],
  isLoadingReviewHistory: false,
  reviewHistoryError: null,

  pendingObjectiveEvaluations: [],
  isLoadingPendingObjectiveEvaluations: false,
  pendingObjectiveEvaluationsError: null,

  isProcessingObjectiveEvaluationApproval: false,
  objectiveEvaluationApprovalError: null,

  objectiveEvaluationHistory: [],
  isLoadingObjectiveEvaluationHistory: false,
  objectiveEvaluationHistoryError: null,
};

const getters = {
  getReviewableTargets: (state) => state.reviewableTargets,
  isLoadingReviewableTargets: (state) => state.loadingReviewableTargets,
  getReviewableTargetsError: (state) => state.reviewableTargetsError,

  getAssignedPerformanceObjectives: (state) =>
    state.assignedPerformanceObjectives,
  isLoadingAssignedPerformanceObjectives: (state) =>
    state.isLoadingAssignedPerformanceObjectives,
  getAssignedPerformanceObjectivesError: (state) =>
    state.assignedPerformanceObjectivesError,
  getCurrentPerformanceEvaluationStatus: (
    state // Getter cho state mới
  ) => state.currentPerformanceEvaluationStatus,
  isSavingPerformanceObjectiveEvaluation: (state) =>
    state.isSavingPerformanceObjectiveEvaluation,
  getSavePerformanceObjectiveEvaluationError: (state) =>
    state.savePerformanceObjectiveEvaluationError,

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

  getReviewHistory: (state) => state.reviewHistory,
  isLoadingReviewHistory: (state) => state.isLoadingReviewHistory,
  getReviewHistoryError: (state) => state.reviewHistoryError,

  getPendingObjectiveEvaluations: (state) => state.pendingObjectiveEvaluations,
  isLoadingPendingObjectiveEvaluations: (state) =>
    state.isLoadingPendingObjectiveEvaluations,
  getPendingObjectiveEvaluationsError: (state) =>
    state.pendingObjectiveEvaluationsError,

  isProcessingObjectiveEvalApproval: (state) =>
    state.isProcessingObjectiveEvaluationApproval,
  getObjectiveEvalApprovalError: (state) =>
    state.objectiveEvaluationApprovalError,

  getObjectiveEvaluationHistory: (state) => state.objectiveEvaluationHistory,
  isLoadingObjectiveEvaluationHistory: (state) =>
    state.isLoadingObjectiveEvaluationHistory,
  getObjectiveEvaluationHistoryError: (state) =>
    state.objectiveEvaluationHistoryError,
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

  async fetchReviewHistory({ commit }, { targetId, targetType }) {
    commit("SET_IS_LOADING_REVIEW_HISTORY", true);
    commit("SET_REVIEW_HISTORY", []);
    commit("SET_REVIEW_HISTORY_ERROR", null);
    try {
      const response = await apiClient.get(
        `/evaluation/review-history/${targetId}`,
        {
          params: { targetType },
        }
      );
      console.log(
        "[Vuex fetchReviewHistory] API response.data:",
        JSON.parse(JSON.stringify(response.data))
      );
      commit("SET_REVIEW_HISTORY", response.data || []);
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch review history.";
      commit("SET_REVIEW_HISTORY_ERROR", errorMsg);
      notification.error({
        message: "Lỗi tải lịch sử review",
        description: errorMsg,
      });
      return null;
    } finally {
      commit("SET_IS_LOADING_REVIEW_HISTORY", false);
    }
  },

  async fetchAssignedPerformanceObjectives(
    { commit },
    { employeeId, cycleId }
  ) {
    commit("SET_IS_LOADING_ASSIGNED_PERFORMANCE_OBJECTIVES", true);
    commit("SET_ASSIGNED_PERFORMANCE_OBJECTIVES", []);
    commit("SET_CURRENT_PERFORMANCE_EVALUATION_STATUS", null); // Reset status
    commit("SET_ASSIGNED_PERFORMANCE_OBJECTIVES_ERROR", null);
    try {
      const response = await apiClient.get(
        `/evaluation/performance-objectives`,
        {
          params: { employeeId, cycleId },
        }
      );

      commit("SET_ASSIGNED_PERFORMANCE_OBJECTIVES", response.data || []);
      if (response.data && Array.isArray(response.data.objectives)) {
        const mappedObjectives = (response.data.objectives || []).map(
          (item) => ({
            ...item,
            // Đảm bảo các trường có giá trị khởi tạo nếu API trả về undefined
            supervisorEvalScore:
              item.supervisorEvalScore === undefined
                ? null
                : item.supervisorEvalScore,
            note: item.note === undefined ? "" : item.note,
            unit: item.unit || "",
          })
        );
        commit("SET_ASSIGNED_PERFORMANCE_OBJECTIVES", mappedObjectives);
        commit(
          "SET_CURRENT_PERFORMANCE_EVALUATION_STATUS",
          response.data.evaluationStatus
        );
        return mappedObjectives; // Trả về objectives đã map
      } else if (Array.isArray(response.data)) {
        // Xử lý nếu API cũ chỉ trả về mảng (fallback)
        console.warn(
          "API for performance objectives returned an array directly. Status will not be available."
        );
        const mappedObjectives = (response.data || []).map((item) => ({
          ...item,
          supervisorEvalScore:
            item.supervisorEvalScore === undefined
              ? null
              : item.supervisorEvalScore,
          note: item.note === undefined ? "" : item.note,
          unit: item.unit || "",
        }));
        commit("SET_ASSIGNED_PERFORMANCE_OBJECTIVES", mappedObjectives);
        commit("SET_CURRENT_PERFORMANCE_EVALUATION_STATUS", null); // Status is unknown
        return mappedObjectives;
      } else {
        console.error(
          "Invalid data structure from /evaluation/performance-objectives:",
          response.data
        );
        throw new Error("Invalid data structure from API");
      }
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch assigned performance objectives.";
      commit("SET_ASSIGNED_PERFORMANCE_OBJECTIVES_ERROR", errorMsg);
      notification.error({
        message: "Lỗi tải mục tiêu đánh giá",
        description: errorMsg,
      });
      return null;
    } finally {
      commit("SET_IS_LOADING_ASSIGNED_PERFORMANCE_OBJECTIVES", false);
    }
  },

  async savePerformanceObjectiveEvaluation({ commit, dispatch }, payload) {
    commit("SET_IS_SAVING_PERFORMANCE_OBJECTIVE_EVALUATION", true);
    commit("SET_SAVE_PERFORMANCE_OBJECTIVE_EVALUATION_ERROR", null);
    try {
      const response = await apiClient.post(
        "/evaluation/performance-objective-evaluations/save",
        payload
      );

      // Thông báo thành công
      notification.success({
        message: "Đánh giá mục tiêu đã được lưu!", // Hoặc thông báo phù hợp hơn
      });

      // Gọi lại fetchAssignedPerformanceObjectives để làm mới toàn bộ dữ liệu
      // Action này sẽ cập nhật cả objectives và status trong store.
      if (payload.employeeId) {
        await dispatch("fetchAssignedPerformanceObjectives", {
          employeeId: payload.employeeId,
          // cycleId: payload.cycleId, // Truyền cycleId nếu có và cần thiết
        });
      }

      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to save performance objective evaluation.";
      commit("SET_SAVE_PERFORMANCE_OBJECTIVE_EVALUATION_ERROR", errorMsg);
      notification.error({
        message: "Lỗi lưu đánh giá mục tiêu",
        description: errorMsg,
      });
      throw error;
    } finally {
      commit("SET_IS_SAVING_PERFORMANCE_OBJECTIVE_EVALUATION", false);
    }
  },

  async fetchPendingObjectiveEvaluations({ commit }) {
    commit("SET_IS_LOADING_PENDING_OBJECTIVE_EVALUATIONS", true);
    commit("SET_PENDING_OBJECTIVE_EVALUATIONS_ERROR", null);
    commit("SET_PENDING_OBJECTIVE_EVALUATIONS", []);
    try {
      const response = await apiClient.get(
        "/evaluation/performance-objective-evaluations/pending-approvals"
      );
      commit("SET_PENDING_OBJECTIVE_EVALUATIONS", response.data || []);
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch pending objective evaluations.";
      commit("SET_PENDING_OBJECTIVE_EVALUATIONS_ERROR", errorMsg);
      notification.error({
        message: "Lỗi tải danh sách đánh giá chờ duyệt",
        description: errorMsg,
      });
      throw error;
    } finally {
      commit("SET_IS_LOADING_PENDING_OBJECTIVE_EVALUATIONS", false);
    }
  },

  async approveObjectiveEvaluationSection(
    { commit, dispatch },
    { evaluationId }
  ) {
    commit("SET_IS_PROCESSING_OBJECTIVE_EVALUATION_APPROVAL", true);
    commit("SET_OBJECTIVE_EVALUATION_APPROVAL_ERROR", null);
    try {
      const response = await apiClient.post(
        `/evaluation/performance-objective-evaluations/${evaluationId}/approve-section`
      );
      notification.success({
        message: "Đánh giá mục tiêu đã được Trưởng bộ phận phê duyệt!",
      });
      await dispatch("fetchPendingObjectiveEvaluations");
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to approve objective evaluation at section level.";
      commit("SET_OBJECTIVE_EVALUATION_APPROVAL_ERROR", errorMsg);
      notification.error({
        message: "Phê duyệt thất bại",
        description: errorMsg,
      });
      throw error;
    } finally {
      commit("SET_IS_PROCESSING_OBJECTIVE_EVALUATION_APPROVAL", false);
    }
  },

  async rejectObjectiveEvaluationSection(
    { commit, dispatch },
    { evaluationId, reason }
  ) {
    commit("SET_IS_PROCESSING_OBJECTIVE_EVALUATION_APPROVAL", true);
    commit("SET_OBJECTIVE_EVALUATION_APPROVAL_ERROR", null);
    try {
      const response = await apiClient.post(
        `/evaluation/performance-objective-evaluations/${evaluationId}/reject-section`,
        { reason }
      );
      notification.success({
        message: "Đánh giá mục tiêu đã bị Trưởng bộ phận từ chối!",
      });
      await dispatch("fetchPendingObjectiveEvaluations");
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to reject objective evaluation at section level.";
      commit("SET_OBJECTIVE_EVALUATION_APPROVAL_ERROR", errorMsg);
      notification.error({
        message: "Từ chối thất bại",
        description: errorMsg,
      });
      throw error;
    } finally {
      commit("SET_IS_PROCESSING_OBJECTIVE_EVALUATION_APPROVAL", false);
    }
  },

  async approveObjectiveEvaluationDept({ commit, dispatch }, { evaluationId }) {
    commit("SET_IS_PROCESSING_OBJECTIVE_EVALUATION_APPROVAL", true);
    commit("SET_OBJECTIVE_EVALUATION_APPROVAL_ERROR", null);
    try {
      const response = await apiClient.post(
        `/evaluation/performance-objective-evaluations/${evaluationId}/approve-department`
      );
      notification.success({
        message: "Đánh giá mục tiêu đã được Trưởng phòng phê duyệt!",
      });
      await dispatch("fetchPendingObjectiveEvaluations");
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to approve objective evaluation at department level.";
      commit("SET_OBJECTIVE_EVALUATION_APPROVAL_ERROR", errorMsg);
      notification.error({
        message: "Phê duyệt thất bại",
        description: errorMsg,
      });
      throw error;
    } finally {
      commit("SET_IS_PROCESSING_OBJECTIVE_EVALUATION_APPROVAL", false);
    }
  },

  async rejectObjectiveEvaluationDept(
    { commit, dispatch },
    { evaluationId, reason }
  ) {
    commit("SET_IS_PROCESSING_OBJECTIVE_EVALUATION_APPROVAL", true);
    commit("SET_OBJECTIVE_EVALUATION_APPROVAL_ERROR", null);
    try {
      const response = await apiClient.post(
        `/evaluation/performance-objective-evaluations/${evaluationId}/reject-department`,
        { reason }
      );
      notification.success({
        message: "Đánh giá mục tiêu đã bị Trưởng phòng từ chối!",
      });
      await dispatch("fetchPendingObjectiveEvaluations");
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to reject objective evaluation at department level.";
      commit("SET_OBJECTIVE_EVALUATION_APPROVAL_ERROR", errorMsg);
      notification.error({
        message: "Từ chối thất bại",
        description: errorMsg,
      });
      throw error;
    } finally {
      commit("SET_IS_PROCESSING_OBJECTIVE_EVALUATION_APPROVAL", false);
    }
  },

  async approveObjectiveEvaluationManager(
    { commit, dispatch },
    { evaluationId }
  ) {
    commit("SET_IS_PROCESSING_OBJECTIVE_EVALUATION_APPROVAL", true);
    commit("SET_OBJECTIVE_EVALUATION_APPROVAL_ERROR", null);
    try {
      const response = await apiClient.post(
        `/evaluation/performance-objective-evaluations/${evaluationId}/approve-manager`
      );
      notification.success({
        message: "Đánh giá mục tiêu đã được Quản lý phê duyệt!",
      });
      await dispatch("fetchPendingObjectiveEvaluations");
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to approve objective evaluation at manager level.";
      commit("SET_OBJECTIVE_EVALUATION_APPROVAL_ERROR", errorMsg);
      notification.error({
        message: "Phê duyệt thất bại",
        description: errorMsg,
      });
      throw error;
    } finally {
      commit("SET_IS_PROCESSING_OBJECTIVE_EVALUATION_APPROVAL", false);
    }
  },

  async rejectObjectiveEvaluationManager(
    { commit, dispatch },
    { evaluationId, reason }
  ) {
    commit("SET_IS_PROCESSING_OBJECTIVE_EVALUATION_APPROVAL", true);
    commit("SET_OBJECTIVE_EVALUATION_APPROVAL_ERROR", null);
    try {
      const response = await apiClient.post(
        `/evaluation/performance-objective-evaluations/${evaluationId}/reject-manager`,
        { reason }
      );
      notification.success({
        message: "Đánh giá mục tiêu đã bị Quản lý từ chối!",
      });
      await dispatch("fetchPendingObjectiveEvaluations");
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to reject objective evaluation at manager level.";
      commit("SET_OBJECTIVE_EVALUATION_APPROVAL_ERROR", errorMsg);
      notification.error({
        message: "Từ chối thất bại",
        description: errorMsg,
      });
      throw error;
    } finally {
      commit("SET_IS_PROCESSING_OBJECTIVE_EVALUATION_APPROVAL", false);
    }
  },

  async fetchObjectiveEvaluationHistory({ commit }, { evaluationId }) {
    commit("SET_IS_LOADING_OBJECTIVE_EVALUATION_HISTORY", true);
    commit("SET_OBJECTIVE_EVALUATION_HISTORY_ERROR", null);
    commit("SET_OBJECTIVE_EVALUATION_HISTORY", []);
    try {
      const response = await apiClient.get(
        `/evaluation/performance-objective-evaluations/${evaluationId}/history`
      );
      commit("SET_OBJECTIVE_EVALUATION_HISTORY", response.data || []);
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch objective evaluation history.";
      commit("SET_OBJECTIVE_EVALUATION_HISTORY_ERROR", errorMsg);
      notification.error({
        message: "Lỗi tải lịch sử đánh giá mục tiêu",
        description: errorMsg,
      });
      throw error;
    } finally {
      commit("SET_IS_LOADING_OBJECTIVE_EVALUATION_HISTORY", false);
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

  SET_REVIEW_HISTORY(state, history) {
    console.log(
      "[Vuex SET_REVIEW_HISTORY] Committing history:",
      JSON.parse(JSON.stringify(history))
    );
    state.reviewHistory = history;
  },
  SET_IS_LOADING_REVIEW_HISTORY(state, isLoading) {
    state.isLoadingReviewHistory = isLoading;
  },
  SET_REVIEW_HISTORY_ERROR(state, error) {
    state.reviewHistoryError = error;
  },
  SET_ASSIGNED_PERFORMANCE_OBJECTIVES(state, objectives) {
    state.assignedPerformanceObjectives = objectives;
  },
  SET_IS_LOADING_ASSIGNED_PERFORMANCE_OBJECTIVES(state, isLoading) {
    state.isLoadingAssignedPerformanceObjectives = isLoading;
  },
  SET_ASSIGNED_PERFORMANCE_OBJECTIVES_ERROR(state, error) {
    state.assignedPerformanceObjectivesError = error;
  },
  SET_CURRENT_PERFORMANCE_EVALUATION_STATUS(state, status) {
    // Mutation cho state mới
    state.currentPerformanceEvaluationStatus = status;
  },
  SET_IS_SAVING_PERFORMANCE_OBJECTIVE_EVALUATION(state, isSaving) {
    state.isSavingPerformanceObjectiveEvaluation = isSaving;
  },
  SET_SAVE_PERFORMANCE_OBJECTIVE_EVALUATION_ERROR(state, error) {
    state.savePerformanceObjectiveEvaluationError = error;
  },

  SET_PENDING_OBJECTIVE_EVALUATIONS(state, items) {
    state.pendingObjectiveEvaluations = items;
  },
  SET_IS_LOADING_PENDING_OBJECTIVE_EVALUATIONS(state, isLoading) {
    state.isLoadingPendingObjectiveEvaluations = isLoading;
  },
  SET_PENDING_OBJECTIVE_EVALUATIONS_ERROR(state, error) {
    state.pendingObjectiveEvaluationsError = error;
  },
  SET_IS_PROCESSING_OBJECTIVE_EVALUATION_APPROVAL(state, isLoading) {
    state.isProcessingObjectiveEvaluationApproval = isLoading;
  },
  SET_OBJECTIVE_EVALUATION_APPROVAL_ERROR(state, error) {
    state.objectiveEvaluationApprovalError = error;
  },
  SET_OBJECTIVE_EVALUATION_HISTORY(state, history) {
    state.objectiveEvaluationHistory = history;
  },
  SET_IS_LOADING_OBJECTIVE_EVALUATION_HISTORY(state, isLoading) {
    state.isLoadingObjectiveEvaluationHistory = isLoading;
  },
  SET_OBJECTIVE_EVALUATION_HISTORY_ERROR(state, error) {
    state.objectiveEvaluationHistoryError = error;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
