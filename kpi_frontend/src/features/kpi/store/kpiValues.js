import { notification } from "ant-design-vue";
import store from "@/core/store";
import { getTranslatedErrorMessage } from "@/core/services/messageTranslator";
import i18n from "@/core/i18n";
import apiClient from "@/core/services/api";

const state = {
  submitUpdateError: null,
  approvalError: null,
  pendingError: null,
  pendingApprovals: [],
};

const getters = {
  getSubmitUpdateError: (state) => state.submitUpdateError,
  getApprovalError: (state) => state.approvalError,
  getPendingError: (state) => state.pendingError,
  getPendingApprovals: (state) => state.pendingApprovals,
};

const mutations = {
  SET_SUBMIT_UPDATE_ERROR(state, error) {
    state.submitUpdateError = error
      ? getTranslatedErrorMessage(error.response?.data?.message) ||
        error.message ||
        i18n.global.t("errors.unknownError")
      : null;
  },
  SET_APPROVAL_ERROR(state, error) {
    state.approvalError = error
      ? getTranslatedErrorMessage(error.response?.data?.message) ||
        error.message ||
        i18n.global.t("errors.unknownError")
      : null;
  },
  SET_PENDING_ERROR(state, error) {
    state.pendingError = error
      ? getTranslatedErrorMessage(error.response?.data?.message) ||
        error.message ||
        i18n.global.t("errors.unknownError")
      : null;
  },
  SET_PENDING_APPROVALS(state, items) {
    state.pendingApprovals = items || [];
  },
};

const actions = {
  /**
   * Action để cập nhật một bản ghi KpiValue hiện có.
   */
  async updateKpiValue(_, { kpiValueId, updateData }) {
    if (!kpiValueId || !updateData) {
      console.error(
        "[kpi-values/updateKpiValue] Missing kpiValueId or updateData."
      );
      notification.error({
        message: i18n.global.t("errors.unknownError"),
        description: i18n.global.t("errors.unknownError"),
        duration: 5,
      });
      return false;
    }

    await store.dispatch("loading/startLoading");
    try {
      const apiUrl = `/kpi-values/${kpiValueId}`;
      await apiClient.patch(apiUrl, updateData);
      notification.success({ message: "Progress updated successfully!" });
      return true;
    } catch (error) {
      const status = error.response?.status;
      const serverMessage = error.response?.data?.message;
      let errorMessage = i18n.global.t("errors.unknownError");

      if (status === 404) {
        errorMessage = i18n.global.t("errors.notFound");
      } else if (serverMessage) {
        errorMessage = getTranslatedErrorMessage(
          Array.isArray(serverMessage)
            ? serverMessage.join(", ")
            : serverMessage
        );
      } else {
        errorMessage =
          getTranslatedErrorMessage(error.message) ||
          i18n.global.t("errors.unknownError");
      }

      console.error(
        `[Vuex kpi-values] Failed to update KPI Value ID ${kpiValueId}:`,
        error.response || error
      );
      notification.error({
        message: i18n.global.t("errors.unknownError"),
        description: errorMessage,
        duration: 5,
      });
      return false;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  /**
   * Submit cập nhật KPI.
   */
  async submitKpiUpdate(
    { commit, dispatch, rootState },
    { assignmentId, updateData }
  ) {
    await store.dispatch("loading/startLoading");
    commit("SET_SUBMIT_UPDATE_ERROR", null);
    try {
      const response = await apiClient.post(
        `/kpi-values/assignments/${assignmentId}/updates`,
        updateData
      );
      const userId = rootState.auth.user?.id;
      if (userId) {
        await dispatch("kpis/fetchMyAssignments", userId, { root: true });
      }
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to submit progress update.";
      commit("SET_SUBMIT_UPDATE_ERROR", errorMsg);
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  /**
   * Duyệt KPI ở cấp Section.
   */
  async approveValueSection({ commit, dispatch }, { valueId }) {
    await store.dispatch("loading/startLoading");
    commit("SET_APPROVAL_ERROR", null);
    try {
      const response = await apiClient.post(
        `/kpi-values/${valueId}/approve-section`
      );
      notification.success({ message: "Section Approved Successfully!" });
      await dispatch("fetchPendingApprovals");
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to approve at section level.";
      commit("SET_APPROVAL_ERROR", errorMsg);
      notification.error({
        message: "Approval Failed",
        description: errorMsg,
      });
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  /**
   * Từ chối KPI ở cấp Section.
   */
  async rejectValueSection({ commit, dispatch }, { valueId, reason }) {
    await store.dispatch("loading/startLoading");
    commit("SET_APPROVAL_ERROR", null);
    try {
      const response = await apiClient.post(
        `/kpi-values/${valueId}/reject-section`,
        { reason }
      );
      notification.success({ message: "Section Rejected Successfully!" });
      await dispatch("fetchPendingApprovals");
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to reject at section level.";
      commit("SET_APPROVAL_ERROR", errorMsg);
      notification.error({
        message: "Rejection Failed",
        description: errorMsg,
      });
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  /**
   * Duyệt KPI ở cấp Department.
   */
  async approveValueDept({ commit, dispatch }, { valueId }) {
    await store.dispatch("loading/startLoading");
    commit("SET_APPROVAL_ERROR", null);
    try {
      const response = await apiClient.post(
        `/kpi-values/${valueId}/approve-department`
      );
      notification.success({ message: "Department Approved Successfully!" });
      await dispatch("fetchPendingApprovals");
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to approve at department level.";
      commit("SET_APPROVAL_ERROR", errorMsg);
      notification.error({
        message: "Approval Failed",
        description: errorMsg,
      });
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  /**
   * Từ chối KPI ở cấp Department.
   */
  async rejectValueDept({ commit, dispatch }, { valueId, reason }) {
    await store.dispatch("loading/startLoading");
    commit("SET_APPROVAL_ERROR", null);
    try {
      const response = await apiClient.post(
        `/kpi-values/${valueId}/reject-department`,
        { reason }
      );
      notification.success({ message: "Department Rejected Successfully!" });
      await dispatch("fetchPendingApprovals");
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to reject at department level.";
      commit("SET_APPROVAL_ERROR", errorMsg);
      notification.error({
        message: "Rejection Failed",
        description: errorMsg,
      });
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  /**
   * Duyệt KPI ở cấp Manager.
   */
  async approveValueManager({ commit, dispatch }, { valueId }) {
    await store.dispatch("loading/startLoading");
    commit("SET_APPROVAL_ERROR", null);
    try {
      const response = await apiClient.post(
        `/kpi-values/${valueId}/approve-manager`
      );
      notification.success({ message: "Manager Approved Successfully!" });
      await dispatch("fetchPendingApprovals");
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to approve at manager level.";
      commit("SET_APPROVAL_ERROR", errorMsg);
      notification.error({
        message: "Approval Failed",
        description: errorMsg,
      });
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  /**
   * Từ chối KPI ở cấp Manager.
   */
  async rejectValueManager({ commit, dispatch }, { valueId, reason }) {
    await store.dispatch("loading/startLoading");
    commit("SET_APPROVAL_ERROR", null);
    try {
      const response = await apiClient.post(
        `/kpi-values/${valueId}/reject-manager`,
        { reason }
      );
      notification.success({ message: "Manager Rejected Successfully!" });
      await dispatch("fetchPendingApprovals");
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to reject at manager level.";
      commit("SET_APPROVAL_ERROR", errorMsg);
      notification.error({
        message: "Rejection Failed",
        description: errorMsg,
      });
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  /**
   * Lấy danh sách KPI chờ duyệt.
   */
  async fetchPendingApprovals({ commit }) {
    await store.dispatch("loading/startLoading");
    commit("SET_PENDING_ERROR", null);
    commit("SET_PENDING_APPROVALS", []);
    try {
      const response = await apiClient.get("/kpi-values/pending-approvals");
      commit("SET_PENDING_APPROVALS", response.data || []);
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch pending approvals.";
      commit("SET_PENDING_ERROR", errorMsg);
      notification.error({
        message: "Loading Failed",
        description: errorMsg,
      });
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  /**
   * Lấy lịch sử KPI Value.
   */
  async fetchValueHistory(_, { valueId }) {
    await store.dispatch("loading/startLoading");
    try {
      const response = await apiClient.get(`/kpi-values/${valueId}/history`);
      return response.data || [];
    } catch (error) {
      console.error(
        `Error fetching history for KpiValue ID ${valueId}:`,
        error
      );
      notification.error({
        message: "Error loading history",
        description:
          error.response?.data?.message ||
          error.message ||
          "Cannot load history for this item.",
      });
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
