import apiClient from "@/core/services/api";
import { notification } from "ant-design-vue";

const state = {
  kpiAwaitingApprovalStats: { total: 0, byLevel: [] },
  loadingKpiAwaitingStats: false,
  kpiAwaitingStatsError: null,

  kpiStatusOverTimeStats: [], // Thay đổi thành mảng rỗng
  loadingKpiStatusOverTime: false,
  kpiStatusOverTimeError: null,

  averageApprovalTimeStats: { totalAverageTime: null, byLevel: [] },
  loadingAverageApprovalTime: false,
  averageApprovalTimeError: null,

  topKpiActivityStats: { submitted: [], updated: [] },
  loadingTopKpiActivity: false,
  topKpiActivityError: null,

  // For Top Pending Approvers
  topPendingApproversStats: [],
  loadingTopPendingApprovers: false,
  topPendingApproversError: null,

  // For KPI Submission Stats
  kpiSubmissionStats: [],
  loadingKpiSubmissionStats: false,
  kpiSubmissionStatsError: null,

  // For KPI Performance Overview
  kpiPerformanceOverviewStats: null,
  loadingKpiPerformanceOverview: false,
  kpiPerformanceOverviewError: null,

  // For KPI Inventory Stats
  kpiInventoryStats: null,
  loadingKpiInventory: false,
  kpiInventoryError: null,
};

const getters = {
  getKpiAwaitingApprovalStats: (state) => state.kpiAwaitingApprovalStats,
  isLoadingKpiAwaitingStats: (state) => state.loadingKpiAwaitingStats,
  getKpiAwaitingStatsError: (state) => state.kpiAwaitingStatsError,

  getKpiStatusOverTimeStats: (state) => state.kpiStatusOverTimeStats,
  isLoadingKpiStatusOverTime: (state) => state.loadingKpiStatusOverTime,
  getKpiStatusOverTimeError: (state) => state.kpiStatusOverTimeError,

  getAverageApprovalTimeStats: (state) => state.averageApprovalTimeStats,
  isLoadingAverageApprovalTime: (state) => state.loadingAverageApprovalTime,
  getAverageApprovalTimeError: (state) => state.averageApprovalTimeError,

  getTopKpiActivityStats: (state) => state.topKpiActivityStats,
  isLoadingTopKpiActivity: (state) => state.loadingTopKpiActivity,
  getTopKpiActivityError: (state) => state.topKpiActivityError,

  // Getter for Top Pending Approvers
  getTopPendingApproversStats: (state) => state.topPendingApproversStats,
  isLoadingTopPendingApprovers: (state) => state.loadingTopPendingApprovers,
  getTopPendingApproversError: (state) => state.topPendingApproversError,

  // Getters for KPI Submission Stats
  getKpiSubmissionStats: (state) => state.kpiSubmissionStats,
  isLoadingKpiSubmissionStats: (state) => state.loadingKpiSubmissionStats,
  getKpiSubmissionStatsError: (state) => state.kpiSubmissionStatsError,

  // Getters for KPI Performance Overview
  getKpiPerformanceOverviewStats: (state) => state.kpiPerformanceOverviewStats,
  isLoadingKpiPerformanceOverview: (state) => state.loadingKpiPerformanceOverview,
  getKpiPerformanceOverviewError: (state) => state.kpiPerformanceOverviewError,

  // Getters for KPI Inventory Stats
  getKpiInventoryStats: (state) => state.kpiInventoryStats,
  isLoadingKpiInventory: (state) => state.loadingKpiInventory,
  getKpiInventoryError: (state) => state.kpiInventoryError,
};

const actions = {
  async fetchKpiAwaitingApprovalStats({ commit }) {
    commit("SET_LOADING_KPI_AWAITING_STATS", true);
    commit("SET_KPI_AWAITING_STATS_ERROR", null);
    commit("SET_KPI_AWAITING_APPROVAL_STATS", { total: 0, byLevel: [] }); // Reset
    try {
      // API endpoint mới từ dashboard controller
      const response = await apiClient.get(
        "/dashboard/statistics/kpi-awaiting-approval"
      );
      commit(
        "SET_KPI_AWAITING_APPROVAL_STATS",
        response.data || { total: 0, byLevel: [] }
      );
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch KPI awaiting approval statistics for dashboard.";
      commit("SET_KPI_AWAITING_STATS_ERROR", errorMsg);
      notification.error({
        message: "Loading Stats Failed",
        description: errorMsg,
      });
      return null;
    } finally {
      commit("SET_LOADING_KPI_AWAITING_STATS", false);
    }
  },

  async fetchKpiStatusOverTimeStats({ commit }, params = { days: 7 }) {
    commit("SET_LOADING_KPI_STATUS_OVER_TIME", true);
    commit("SET_KPI_STATUS_OVER_TIME_ERROR", null);
    commit("SET_KPI_STATUS_OVER_TIME_STATS", []); // Reset thành mảng rỗng
    try {
      const response = await apiClient.get(
        "/dashboard/statistics/kpi-status-over-time",
        { params }
      );
      commit("SET_KPI_STATUS_OVER_TIME_STATS", response.data || []); // Lưu dữ liệu mảng
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch KPI status over time statistics.";
      commit("SET_KPI_STATUS_OVER_TIME_ERROR", errorMsg);
      notification.error({
        message: "Loading Stats Failed",
        description: errorMsg,
      });
      return null;
    } finally {
      commit("SET_LOADING_KPI_STATUS_OVER_TIME", false);
    }
  },

  async fetchAverageApprovalTimeStats({ commit }) {
    commit("SET_LOADING_AVERAGE_APPROVAL_TIME", true);
    commit("SET_AVERAGE_APPROVAL_TIME_ERROR", null);
    commit("SET_AVERAGE_APPROVAL_TIME_STATS", {
      totalAverageTime: null,
      byLevel: [],
    }); // Reset
    try {
      const response = await apiClient.get(
        "/dashboard/statistics/average-approval-time"
      );
      commit(
        "SET_AVERAGE_APPROVAL_TIME_STATS",
        response.data || { totalAverageTime: null, byLevel: [] }
      );
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch average approval time statistics.";
      commit("SET_AVERAGE_APPROVAL_TIME_ERROR", errorMsg);
      notification.error({
        message: "Loading Stats Failed",
        description: errorMsg,
      });
      return null;
    } finally {
      commit("SET_LOADING_AVERAGE_APPROVAL_TIME", false);
    }
  },

  async fetchTopKpiActivityStats({ commit }, params = { days: 30, limit: 5 }) {
    commit("SET_LOADING_TOP_KPI_ACTIVITY", true);
    commit("SET_TOP_KPI_ACTIVITY_ERROR", null);
    commit("SET_TOP_KPI_ACTIVITY_STATS", { submitted: [], updated: [] }); // Reset
    try {
      const response = await apiClient.get(
        "/dashboard/statistics/top-kpi-activity",
        { params }
      );
      commit(
        "SET_TOP_KPI_ACTIVITY_STATS",
        response.data || { submitted: [], updated: [] }
      );
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch top KPI activity statistics.";
      commit("SET_TOP_KPI_ACTIVITY_ERROR", errorMsg);
      notification.error({
        message: "Loading Stats Failed",
        description: errorMsg,
      });
      return null;
    } finally {
      commit("SET_LOADING_TOP_KPI_ACTIVITY", false);
    }
  },

  async fetchTopPendingApproversStats({ commit }, params = { limit: 5 }) {
    commit("SET_LOADING_TOP_PENDING_APPROVERS", true);
    commit("SET_TOP_PENDING_APPROVERS_ERROR", null);
    commit("SET_TOP_PENDING_APPROVERS_STATS", []); // Reset
    try {
      const response = await apiClient.get(
        "/dashboard/statistics/top-pending-approvers",
        { params }
      );
      commit(
        "SET_TOP_PENDING_APPROVERS_STATS",
        response.data || []
      );
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch top pending approvers statistics.";
      commit("SET_TOP_PENDING_APPROVERS_ERROR", errorMsg);
      notification.error({
        message: "Loading Stats Failed",
        description: errorMsg,
      });
      return null;
    } finally {
      commit("SET_LOADING_TOP_PENDING_APPROVERS", false);
    }
  },

  async fetchKpiSubmissionStats({ commit }, params) {
    commit("SET_LOADING_KPI_SUBMISSION_STATS", true);
    commit("SET_KPI_SUBMISSION_STATS_ERROR", null);
    commit("SET_KPI_SUBMISSION_STATS", []); // Reset
    try {
      const response = await apiClient.get(
        "/dashboard/statistics/kpi-submission-stats",
        { params }
      );
      commit(
        "SET_KPI_SUBMISSION_STATS",
        response.data || []
      );
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch KPI submission statistics.";
      commit("SET_KPI_SUBMISSION_STATS_ERROR", errorMsg);
      notification.error({
        message: "Loading Stats Failed",
        description: errorMsg,
      });
      return null;
    } finally {
      commit("SET_LOADING_KPI_SUBMISSION_STATS", false);
    }
  },

  async fetchKpiInventoryStats({ commit }) {
    commit("SET_LOADING_KPI_INVENTORY", true);
    commit("SET_KPI_INVENTORY_ERROR", null);
    commit("SET_KPI_INVENTORY_STATS", null); // Reset
    try {
      const response = await apiClient.get(
        "/dashboard/statistics/kpi-inventory-stats"
      );
      commit(
        "SET_KPI_INVENTORY_STATS",
        response.data || null
      );
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch KPI inventory statistics.";
      commit("SET_KPI_INVENTORY_ERROR", errorMsg);
      notification.error({
        message: "Loading Stats Failed",
        description: errorMsg,
      });
      return null;
    } finally {
      commit("SET_LOADING_KPI_INVENTORY", false);
    }
  },

  async fetchKpiPerformanceOverviewStats({ commit }, params = { daysForNotUpdated: 7 }) {
    commit("SET_LOADING_KPI_PERFORMANCE_OVERVIEW", true);
    commit("SET_KPI_PERFORMANCE_OVERVIEW_ERROR", null);
    commit("SET_KPI_PERFORMANCE_OVERVIEW_STATS", null); // Reset
    try {
      const response = await apiClient.get(
        "/dashboard/statistics/kpi-performance-overview",
        { params }
      );
      commit(
        "SET_KPI_PERFORMANCE_OVERVIEW_STATS",
        response.data || null
      );
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch KPI performance overview statistics.";
      commit("SET_KPI_PERFORMANCE_OVERVIEW_ERROR", errorMsg);
      notification.error({
        message: "Loading Stats Failed",
        description: errorMsg,
      });
      return null;
    } finally {
      commit("SET_LOADING_KPI_PERFORMANCE_OVERVIEW", false);
    }
  },
};

const mutations = {
  SET_KPI_AWAITING_APPROVAL_STATS(state, stats) {
    state.kpiAwaitingApprovalStats = stats;
  },
  SET_LOADING_KPI_AWAITING_STATS(state, isLoading) {
    state.loadingKpiAwaitingStats = isLoading;
  },
  SET_KPI_AWAITING_STATS_ERROR(state, error) {
    state.kpiAwaitingStatsError = error;
  },

  SET_KPI_STATUS_OVER_TIME_STATS(state, stats) {
    state.kpiStatusOverTimeStats = stats;
  },
  SET_LOADING_KPI_STATUS_OVER_TIME(state, isLoading) {
    state.loadingKpiStatusOverTime = isLoading;
  },
  SET_KPI_STATUS_OVER_TIME_ERROR(state, error) {
    state.kpiStatusOverTimeError = error;
  },

  SET_AVERAGE_APPROVAL_TIME_STATS(state, stats) {
    state.averageApprovalTimeStats = stats;
  },
  SET_LOADING_AVERAGE_APPROVAL_TIME(state, isLoading) {
    state.loadingAverageApprovalTime = isLoading;
  },
  SET_AVERAGE_APPROVAL_TIME_ERROR(state, error) {
    state.averageApprovalTimeError = error;
  },

  SET_TOP_KPI_ACTIVITY_STATS(state, stats) {
    state.topKpiActivityStats = stats;
  },
  SET_LOADING_TOP_KPI_ACTIVITY(state, isLoading) {
    state.loadingTopKpiActivity = isLoading;
  },
  SET_TOP_KPI_ACTIVITY_ERROR(state, error) {
    state.topKpiActivityError = error;
  },

  // Mutations for Top Pending Approvers
  SET_TOP_PENDING_APPROVERS_STATS(state, stats) {
    state.topPendingApproversStats = stats;
  },
  SET_LOADING_TOP_PENDING_APPROVERS(state, isLoading) {
    state.loadingTopPendingApprovers = isLoading;
  },
  SET_TOP_PENDING_APPROVERS_ERROR(state, error) {
    state.topPendingApproversError = error;
  },

  // Mutations for KPI Submission Stats
  SET_KPI_SUBMISSION_STATS(state, stats) {
    state.kpiSubmissionStats = stats;
  },
  SET_LOADING_KPI_SUBMISSION_STATS(state, isLoading) {
    state.loadingKpiSubmissionStats = isLoading;
  },
  SET_KPI_SUBMISSION_STATS_ERROR(state, error) {
    state.kpiSubmissionStatsError = error;
  },

  // Mutations for KPI Performance Overview
  SET_KPI_PERFORMANCE_OVERVIEW_STATS(state, stats) {
    state.kpiPerformanceOverviewStats = stats;
  },
  SET_LOADING_KPI_PERFORMANCE_OVERVIEW(state, isLoading) {
    state.loadingKpiPerformanceOverview = isLoading;
  },
  SET_KPI_PERFORMANCE_OVERVIEW_ERROR(state, error) {
    state.kpiPerformanceOverviewError = error;
  },

  // Mutations for KPI Inventory Stats
  SET_KPI_INVENTORY_STATS(state, stats) {
    state.kpiInventoryStats = stats;
  },
  SET_LOADING_KPI_INVENTORY(state, isLoading) {
    state.loadingKpiInventory = isLoading;
  },
  SET_KPI_INVENTORY_ERROR(state, error) {
    state.kpiInventoryError = error;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
