import apiClient from "@/core/services/api";
import store from "@/core/store"; // Dùng store chính để dispatch loading toàn cục

const state = {
  departments: [],
  error: null,
  departmentDetail: null,
  detailError: null,
};

const getters = {
  departmentList: (state) => state.departments,
  error: (state) => state.error,
  departmentDetail: (state) => state.departmentDetail,
  detailError: (state) => state.detailError,
};

const mutations = {
  SET_ERROR(state, error) {
    state.error = error ? error.response?.data?.message || error.message : null;
  },
  SET_DEPARTMENTS(state, departments) {
    state.departments = departments;
  },
  SET_DEPARTMENT_DETAIL(state, detail) {
    state.departmentDetail = detail;
  },
  SET_DETAIL_ERROR(state, error) {
    state.detailError = error
      ? error.response?.data?.message || error.message
      : null;
  },
};

const actions = {
  async fetchDepartments({ commit }, params = {}) {
    await store.dispatch("loading/startLoading");
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.get("/departments", { params });
      commit("SET_DEPARTMENTS", response.data);
    } catch (error) {
      commit("SET_ERROR", error);
      commit("SET_DEPARTMENTS", []);
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },
  async fetchDepartmentById({ commit }, departmentId) {
    if (!departmentId) {
      commit("SET_DETAIL_ERROR", "Department ID is required.");
      return null;
    }
    await store.dispatch("loading/startLoading");
    commit("SET_DETAIL_ERROR", null);
    try {
      const response = await apiClient.get(`/departments/${departmentId}`);
      commit("SET_DEPARTMENT_DETAIL", response.data);
      return response.data;
    } catch (error) {
      commit("SET_DETAIL_ERROR", error);
      commit("SET_DEPARTMENT_DETAIL", null);
      return null;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },
  async createDepartment({ dispatch, commit }, payload) {
    await store.dispatch("loading/startLoading");
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.post("/departments", payload);
      await dispatch("fetchDepartments", { forceRefresh: true });
      return response.data;
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },
  async updateDepartment({ dispatch, commit }, { id, data }) {
    await store.dispatch("loading/startLoading");
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.put(`/departments/${id}`, data);
      await dispatch("fetchDepartments", { forceRefresh: true });
      return response.data;
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  async deleteDepartment({ dispatch, commit }, id) {
    await store.dispatch("loading/startLoading");
    commit("SET_ERROR", null);
    try {
      await apiClient.delete(`/departments/${id}`);
      await dispatch("fetchDepartments", { forceRefresh: true });
      return true;
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error.message ||
        "Xóa phòng ban thất bại";
      commit("SET_ERROR", msg);
      throw new Error(msg);
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
