import apiClient from "@/core/services/api";
import { notification } from "ant-design-vue";
import store from "@/core/store"; // Để dispatch loading toàn cục

const state = {
  kpiAwaitingApprovalStats: { total: 0, byLevel: [] },
  kpiAwaitingStatsError: null,

  kpiStatusOverTimeStats: [],
  kpiStatusOverTimeError: null,

  averageApprovalTimeStats: { totalAverageTime: null, byLevel: [] },
  averageApprovalTimeError: null,

  topKpiActivityStats: { submitted: [], updated: [] },
  topKpiActivityError: null,

  topPendingApproversStats: [],
  topPendingApproversError: null,

  kpiSubmissionStats: [],
  kpiSubmissionStatsError: null,

  kpiPerformanceOverviewStats: null,
  kpiPerformanceOverviewError: null,

  kpiInventoryStats: null,
  kpiInventoryError: null,
};

const getters = {
  getKpiAwaitingApprovalStats: (state) => state.kpiAwaitingApprovalStats,
  getKpiAwaitingStatsError: (state) => state.kpiAwaitingStatsError,

  getKpiStatusOverTimeStats: (state) => state.kpiStatusOverTimeStats,
  getKpiStatusOverTimeError: (state) => state.kpiStatusOverTimeError,

  getAverageApprovalTimeStats: (state) => state.averageApprovalTimeStats,
  getAverageApprovalTimeError: (state) => state.averageApprovalTimeError,

  getTopKpiActivityStats: (state) => state.topKpiActivityStats,
  getTopKpiActivityError: (state) => state.topKpiActivityError,

  getTopPendingApproversStats: (state) => state.topPendingApproversStats,
  getTopPendingApproversError: (state) => state.topPendingApproversError,

  getKpiSubmissionStats: (state) => state.kpiSubmissionStats,
  getKpiSubmissionStatsError: (state) => state.kpiSubmissionStatsError,

  getKpiPerformanceOverviewStats: (state) => state.kpiPerformanceOverviewStats,
  getKpiPerformanceOverviewError: (state) => state.kpiPerformanceOverviewError,

  getKpiInventoryStats: (state) => state.kpiInventoryStats,
  getKpiInventoryError: (state) => state.kpiInventoryError,
};

const actions = {
  async fetchKpiAwaitingApprovalStats({ commit }) {
    await store.dispatch("loading/startLoading");
    commit("SET_KPI_AWAITING_STATS_ERROR", null);
    commit("SET_KPI_AWAITING_APPROVAL_STATS", { total: 0, byLevel: [] });
    try {
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
      await store.dispatch("loading/stopLoading");
    }
  },

  async fetchKpiStatusOverTimeStats({ commit }, params = { days: 7 }) {
    await store.dispatch("loading/startLoading");
    commit("SET_KPI_STATUS_OVER_TIME_ERROR", null);
    commit("SET_KPI_STATUS_OVER_TIME_STATS", []);
    try {
      const response = await apiClient.get(
        "/dashboard/statistics/kpi-status-over-time",
        { params }
      );
      commit("SET_KPI_STATUS_OVER_TIME_STATS", response.data || []);
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
      await store.dispatch("loading/stopLoading");
    }
  },

  async fetchAverageApprovalTimeStats({ commit }) {
    await store.dispatch("loading/startLoading");
    commit("SET_AVERAGE_APPROVAL_TIME_ERROR", null);
    commit("SET_AVERAGE_APPROVAL_TIME_STATS", {
      totalAverageTime: null,
      byLevel: [],
    });
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
      await store.dispatch("loading/stopLoading");
    }
  },

  async fetchTopKpiActivityStats({ commit }, params = { days: 30, limit: 5 }) {
    await store.dispatch("loading/startLoading");
    commit("SET_TOP_KPI_ACTIVITY_ERROR", null);
    commit("SET_TOP_KPI_ACTIVITY_STATS", { submitted: [], updated: [] });
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
      await store.dispatch("loading/stopLoading");
    }
  },

  async fetchTopPendingApproversStats({ commit }, params = { limit: 5 }) {
    await store.dispatch("loading/startLoading");
    commit("SET_TOP_PENDING_APPROVERS_ERROR", null);
    commit("SET_TOP_PENDING_APPROVERS_STATS", []);
    try {
      const response = await apiClient.get(
        "/dashboard/statistics/top-pending-approvers",
        { params }
      );
      commit("SET_TOP_PENDING_APPROVERS_STATS", response.data || []);
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
      await store.dispatch("loading/stopLoading");
    }
  },

  async fetchKpiSubmissionStats({ commit }, params) {
    await store.dispatch("loading/startLoading");
    commit("SET_KPI_SUBMISSION_STATS_ERROR", null);
    commit("SET_KPI_SUBMISSION_STATS", []);
    try {
      const response = await apiClient.get(
        "/dashboard/statistics/kpi-submission-stats",
        { params }
      );
      commit("SET_KPI_SUBMISSION_STATS", response.data || []);
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
      await store.dispatch("loading/stopLoading");
    }
  },

  async fetchKpiInventoryStats({ commit }) {
    await store.dispatch("loading/startLoading");
    commit("SET_KPI_INVENTORY_ERROR", null);
    commit("SET_KPI_INVENTORY_STATS", null);
    try {
      const response = await apiClient.get(
        "/dashboard/statistics/kpi-inventory-stats"
      );
      commit("SET_KPI_INVENTORY_STATS", response.data || null);
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
      await store.dispatch("loading/stopLoading");
    }
  },

  async fetchKpiPerformanceOverviewStats(
    { commit },
    params = { daysForNotUpdated: 7 }
  ) {
    await store.dispatch("loading/startLoading");
    commit("SET_KPI_PERFORMANCE_OVERVIEW_ERROR", null);
    commit("SET_KPI_PERFORMANCE_OVERVIEW_STATS", null);
    try {
      const response = await apiClient.get(
        "/dashboard/statistics/kpi-performance-overview",
        { params }
      );
      commit("SET_KPI_PERFORMANCE_OVERVIEW_STATS", response.data || null);
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
      await store.dispatch("loading/stopLoading");
    }
  },
};

const mutations = {
  SET_KPI_AWAITING_APPROVAL_STATS(state, stats) {
    state.kpiAwaitingApprovalStats = stats;
  },
  SET_KPI_AWAITING_STATS_ERROR(state, error) {
    state.kpiAwaitingStatsError = error;
  },

  SET_KPI_STATUS_OVER_TIME_STATS(state, stats) {
    state.kpiStatusOverTimeStats = stats;
  },
  SET_KPI_STATUS_OVER_TIME_ERROR(state, error) {
    state.kpiStatusOverTimeError = error;
  },

  SET_AVERAGE_APPROVAL_TIME_STATS(state, stats) {
    state.averageApprovalTimeStats = stats;
  },
  SET_AVERAGE_APPROVAL_TIME_ERROR(state, error) {
    state.averageApprovalTimeError = error;
  },

  SET_TOP_KPI_ACTIVITY_STATS(state, stats) {
    state.topKpiActivityStats = stats;
  },
  SET_TOP_KPI_ACTIVITY_ERROR(state, error) {
    state.topKpiActivityError = error;
  },

  SET_TOP_PENDING_APPROVERS_STATS(state, stats) {
    state.topPendingApproversStats = stats;
  },
  SET_TOP_PENDING_APPROVERS_ERROR(state, error) {
    state.topPendingApproversError = error;
  },

  SET_KPI_SUBMISSION_STATS(state, stats) {
    state.kpiSubmissionStats = stats;
  },
  SET_KPI_SUBMISSION_STATS_ERROR(state, error) {
    state.kpiSubmissionStatsError = error;
  },

  SET_KPI_PERFORMANCE_OVERVIEW_STATS(state, stats) {
    state.kpiPerformanceOverviewStats = stats;
  },
  SET_KPI_PERFORMANCE_OVERVIEW_ERROR(state, error) {
    state.kpiPerformanceOverviewError = error;
  },

  SET_KPI_INVENTORY_STATS(state, stats) {
    state.kpiInventoryStats = stats;
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
