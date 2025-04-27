// src/store/modules/kpiValues.js
import apiClient from "../../services/api";
import { notification } from "ant-design-vue";

export default {
  namespaced: true,

  state: {
    submitUpdateError: null,
  },

  getters: {
    getSubmitUpdateError: (state) => state.submitUpdateError,
  },

  actions: {
    /**
     * Action để cập nhật một bản ghi KpiValue hiện có.
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

    async submitKpiUpdate({ commit }, { assignmentId, updateData }) {
      commit("setSubmitUpdateError", null);
      try {
        const response = await apiClient.post(
          `/kpi-values/assignments/${assignmentId}/updates`,
          updateData
        );
        return response.data;
      } catch (error) {
        commit(
          "setSubmitUpdateError",
          error.response?.data?.message || "Failed to submit progress update."
        );
        throw error;
      }
    },
  },

  mutations: {
    setSubmitUpdateError(state, error) {
      state.submitUpdateError = error;
    },
  },
};
