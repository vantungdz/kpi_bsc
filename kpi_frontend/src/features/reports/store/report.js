// /e/project/kpi-frontend/src/features/reports/store/reports.js
import apiClient from "@/core/services/api";
import { notification } from "ant-design-vue";

const state = {
  loading: false,
  error: null,
  reportData: null,
};

const getters = {
  isLoading: (state) => state.loading,
  hasError: (state) => state.error !== null,
  getError: (state) => state.error,
  getReportData: (state) => state.reportData,
};

const actions = {
  async generateReport(
    { commit, dispatch },
    { reportType, fileFormat, startDate, endDate }
  ) {
    commit("setLoading", true);
    commit("setError", null);
    try {
      const response = await apiClient.get("/reports/generate", {
        params: {
          reportType,
          fileFormat,
          startDate,
          endDate,
        },
        responseType: "blob", // Quan trọng để nhận file từ backend
      });

      // Lấy tên file thực tế từ header nếu có
      let fileName = `report.${fileFormat === 'excel' ? 'xlsx' : fileFormat}`;
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
      link.setAttribute("download", fileName); // Đặt tên file đúng từ backend
      document.body.appendChild(link);
      link.click();

      // Giải phóng bộ nhớ
      window.URL.revokeObjectURL(url);
      commit("setReportData", response.data);
      return true; // <-- Đảm bảo luôn trả về Promise
    } catch (error) {
      commit("setError", error);
      dispatch("showErrorNotification", {
        message: "Xuất báo cáo thất bại",
        description:
          error.response?.data?.message || "Có lỗi xảy ra khi xuất báo cáo.",
      });
      throw error; // <-- Đảm bảo trả về Promise bị reject
    } finally {
      commit("setLoading", false);
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
  setLoading(state, loading) {
    state.loading = loading;
  },
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
