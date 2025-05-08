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
  // Thêm các actions khác cho dashboard nếu cần
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
  // Thêm các mutations khác cho dashboard nếu cần
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
