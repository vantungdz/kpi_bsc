import apiClient from "@/core/services/api";
import { notification } from "ant-design-vue";
import store from "@/core/store";

const state = {
  error: null,
  reportData: null,
};

const getters = {
  hasError: (state) => state.error !== null,
  getError: (state) => state.error,
  getReportData: (state) => state.reportData,
};

const actions = {
  async generateReport(
    { commit, dispatch },
    { reportType, fileFormat, startDate, endDate }
  ) {
    await store.dispatch("loading/startLoading");
    commit("setError", null);
    try {
      const response = await apiClient.get("/reports/generate", {
        params: {
          reportType,
          fileFormat,
          startDate,
          endDate,
        },
        responseType: "blob",
      });

      let fileName = `report.${fileFormat === "excel" ? "xlsx" : fileFormat}`;
      const disposition = response.headers["content-disposition"];
      if (disposition) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) {
          fileName = match[1];
        }
      }
      const blob = new Blob([response.data], {
        type: response.headers["content-type"],
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();

      window.URL.revokeObjectURL(url);
      commit("setReportData", response.data);
      return true;
    } catch (error) {
      commit("setError", error);

      const errorMsg = error.response?.data?.message;
      if (!errorMsg.includes("No permission")) {
        dispatch("showErrorNotification", {
          message: "Export report failed",
          description: errorMsg,
        });
      }

      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },
  showErrorNotification(_, { message, description }) {
    notification.error({
      message: message,
      description: description,
    });
  },
};

const mutations = {
  setError(state, error) {
    state.error = error;
  },
  setReportData(state, reportData) {
    state.reportData = reportData;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
