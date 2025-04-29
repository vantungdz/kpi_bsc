// store/kpiValues.js
import apiClient from "../../services/api";
import { notification } from "ant-design-vue";

export default {
  namespaced: true, // Giữ nguyên namespaced

  state: {
    // --- Cập nhật và Bổ sung State ---
    isSubmittingUpdate: false, // Trạng thái loading cho submit
    submitUpdateError: null,
    isProcessingApproval: false, // Trạng thái loading chung cho duyệt/từ chối
    approvalError: null,
    pendingApprovals: [], // Danh sách các KpiValue chờ duyệt
    loadingPending: false, // Trạng thái loading fetch danh sách
    pendingError: null,
    // --- Kết thúc ---
  },

  getters: {
    // --- Cập nhật và Bổ sung Getters ---
    isSubmittingUpdate: (state) => state.isSubmittingUpdate,
    getSubmitUpdateError: (state) => state.submitUpdateError,
    isProcessingApproval: (state) => state.isProcessingApproval,
    getApprovalError: (state) => state.approvalError,
    getPendingApprovals: (state) => state.pendingApprovals,
    isLoadingPending: (state) => state.loadingPending,
    getPendingError: (state) => state.pendingError,
    // --- Kết thúc ---
  },

  actions: {
    /**
     * Action để cập nhật một bản ghi KpiValue hiện có (Giữ nguyên nếu cần).
     */
    async updateKpiValue(_, { kpiValueId, updateData }) {
      if (!kpiValueId || !updateData) {
        console.error(
          "[kpi-values/updateKpiValue] Missing kpiValueId or updateData."
        );
        notification.error({
          message: "Update Failed",
          description: "Missing required data to update progress.",
        });
        return false;
      }

      try {
        const apiUrl = `/kpi-values/${kpiValueId}`;
        await apiClient.patch(apiUrl, updateData);
        notification.success({ message: "Progress updated successfully!" });
        return true;
      } catch (error) {
        const status = error.response?.status;
        const serverMessage = error.response?.data?.message;
        let errorMessage = "Failed to update progress.";

        if (status === 404) {
          errorMessage = `KPI Value record with ID ${kpiValueId} not found.`;
        } else if (serverMessage) {
          errorMessage = Array.isArray(serverMessage)
            ? serverMessage.join(", ")
            : serverMessage;
        } else {
          errorMessage = error.message || "An unknown error occurred.";
        }

        console.error(
          `[Vuex kpi-values] Failed to update KPI Value ID ${kpiValueId}:`,
          error.response || error
        );
        notification.error({
          message: "Update Failed",
          description: errorMessage,
        });
        return false;
      }
    },

    // --- Cập nhật submitKpiUpdate ---
    async submitKpiUpdate({ commit }, { assignmentId, updateData }) {
      commit("SET_SUBMITTING_UPDATE", true); // <-- Bật loading
      commit("SET_SUBMIT_UPDATE_ERROR", null); // Đổi tên mutation cho nhất quán
      try {
        const response = await apiClient.post(
          `/kpi-values/assignments/${assignmentId}/updates`,
          updateData
        );
        // Không cần notification ở đây nữa, KpiPersonal.vue đã có
        // Sau khi submit thành công, cần cập nhật lại danh sách KPI của người dùng
        // TODO: Xác định cách tốt nhất để cập nhật UI. Ví dụ: gọi lại action fetchMyAssignments
        // Ví dụ: dispatch('kpis/fetchMyAssignments', userId, { root: true }); // Cần userId
        return response.data; // Trả về KpiValue mới/đã cập nhật
      } catch (error) {
        const errorMsg =
          error.response?.data?.message ||
          error.message ||
          "Failed to submit progress update.";
        commit("SET_SUBMIT_UPDATE_ERROR", errorMsg);
        throw error;
      } finally {
        commit("SET_SUBMITTING_UPDATE", false); // <-- Tắt loading
      }
    },
    // --- Kết thúc cập nhật ---

    // --- THÊM ACTIONS WORKFLOW MỚI ---
    async approveValueSection({ commit }, { valueId }) {
      commit("SET_PROCESSING_APPROVAL", true);
      commit("SET_APPROVAL_ERROR", null);
      try {
        const response = await apiClient.post(
          `/kpi-values/${valueId}/approve-section`
        );
        notification.success({ message: "Section Approved Successfully!" });
        // TODO: Cập nhật UI sau khi thành công (ví dụ: fetch lại danh sách chờ duyệt)
        // await dispatch('fetchPendingSectionApprovals'); // Ví dụ
        return response.data; // Trả về KpiValue đã cập nhật
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
        commit("SET_PROCESSING_APPROVAL", false);
      }
    },

    async rejectValueSection({ commit }, { valueId, reason }) {
      commit("SET_PROCESSING_APPROVAL", true);
      commit("SET_APPROVAL_ERROR", null);
      try {
        const response = await apiClient.post(
          `/kpi-values/${valueId}/reject-section`,
          { reason }
        );
        notification.success({ message: "Section Rejected Successfully!" });
        // TODO: Cập nhật UI sau khi thành công
        // await dispatch('fetchPendingSectionApprovals');
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
        commit("SET_PROCESSING_APPROVAL", false);
      }
    },

    async approveValueDept({ commit }, { valueId }) {
      commit("SET_PROCESSING_APPROVAL", true);
      commit("SET_APPROVAL_ERROR", null);
      try {
        const response = await apiClient.post(
          `/kpi-values/${valueId}/approve-department`
        );
        notification.success({ message: "Department Approved Successfully!" });
        // TODO: Cập nhật UI
        // await dispatch('fetchPendingDeptApprovals');
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
        commit("SET_PROCESSING_APPROVAL", false);
      }
    },

    async rejectValueDept({ commit }, { valueId, reason }) {
      commit("SET_PROCESSING_APPROVAL", true);
      commit("SET_APPROVAL_ERROR", null);
      try {
        const response = await apiClient.post(
          `/kpi-values/${valueId}/reject-department`,
          { reason }
        );
        notification.success({ message: "Department Rejected Successfully!" });
        // TODO: Cập nhật UI
        // await dispatch('fetchPendingDeptApprovals');
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
        commit("SET_PROCESSING_APPROVAL", false);
      }
    },

    async approveValueManager({ commit }, { valueId }) {
      commit("SET_PROCESSING_APPROVAL", true);
      commit("SET_APPROVAL_ERROR", null);
      try {
        const response = await apiClient.post(
          `/kpi-values/${valueId}/approve-manager`
        );
        notification.success({ message: "Manager Approved Successfully!" });
        // TODO: Cập nhật UI
        // await dispatch('fetchPendingManagerApprovals');
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
        commit("SET_PROCESSING_APPROVAL", false);
      }
    },

    async rejectValueManager({ commit }, { valueId, reason }) {
      commit("SET_PROCESSING_APPROVAL", true);
      commit("SET_APPROVAL_ERROR", null);
      try {
        const response = await apiClient.post(
          `/kpi-values/${valueId}/reject-manager`,
          { reason }
        );
        notification.success({ message: "Manager Rejected Successfully!" });
        // TODO: Cập nhật UI
        // await dispatch('fetchPendingManagerApprovals');
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
        commit("SET_PROCESSING_APPROVAL", false);
      }
    },
    async fetchPendingApprovals({ commit /*, rootState */ }) {
      // const user = rootState.auth.user; // Lấy thông tin user nếu cần gửi lên backend (hiện tại backend tự xử lý)
      commit("SET_LOADING_PENDING", true);
      commit("SET_PENDING_ERROR", null);
      commit("SET_PENDING_APPROVALS", []); // Xóa danh sách cũ trước khi fetch

      try {
        const response = await apiClient.get("/kpi-values/pending-approvals");
        commit("SET_PENDING_APPROVALS", response.data || []); // Lưu danh sách lấy được
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
        commit("SET_LOADING_PENDING", false);
      }
    },
  },

  mutations: {
    // --- Cập nhật và Bổ sung Mutations ---
    SET_SUBMITTING_UPDATE(state, isLoading) {
      // Đổi tên cho nhất quán
      state.isSubmittingUpdate = isLoading;
    },
    SET_SUBMIT_UPDATE_ERROR(state, error) {
      // Đổi tên cho nhất quán
      state.submitUpdateError = error;
    },
    SET_PROCESSING_APPROVAL(state, isLoading) {
      state.isProcessingApproval = isLoading;
    },
    SET_APPROVAL_ERROR(state, error) {
      state.approvalError = error;
    },
    SET_PENDING_APPROVALS(state, items) {
      state.pendingApprovals = items;
    },
    SET_LOADING_PENDING(state, isLoading) {
      state.loadingPending = isLoading;
    },
    SET_PENDING_ERROR(state, error) {
      state.pendingError = error;
    },
    // --- Kết thúc ---
  },
};
