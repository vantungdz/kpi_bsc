import apiClient from "@/core/services/api";

const state = {
  departments: [],
  loading: false,
  error: null,
  departmentDetail: null, // thêm
  loadingDetail: false,   // thêm
  detailError: null,      // thêm
};

const getters = {
  departmentList: (state) => state.departments,
  isLoading: (state) => state.loading,
  error: (state) => state.error,
  departmentDetail: (state) => state.departmentDetail, // thêm
  isLoadingDetail: (state) => state.loadingDetail,     // thêm
  detailError: (state) => state.detailError,           // thêm
};

const mutations = {
  SET_LOADING(state, isLoading) {
    state.loading = isLoading;
  },
  SET_ERROR(state, error) {
    state.error = error ? error.response?.data?.message || error.message : null;
  },
  SET_DEPARTMENTS(state, departments) {
    state.departments = departments;
  },
  SET_DEPARTMENT_DETAIL(state, detail) { // thêm
    state.departmentDetail = detail;
  },
  SET_LOADING_DETAIL(state, isLoading) { // thêm
    state.loadingDetail = isLoading;
  },
  SET_DETAIL_ERROR(state, error) { // thêm
    state.detailError = error ? error.response?.data?.message || error.message : null;
  },
};

const actions = {
  async fetchDepartments({ commit }, params = {}) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.get("/departments", { params });
      commit("SET_DEPARTMENTS", response.data);
    } catch (error) {
      commit("SET_ERROR", error);
      commit("SET_DEPARTMENTS", []);
    } finally {
      commit("SET_LOADING", false);
    }
  },
  async fetchDepartmentById({ commit }, departmentId) { // thêm
    if (!departmentId) {
      commit("SET_DETAIL_ERROR", "Department ID is required.");
      return null;
    }
    commit("SET_LOADING_DETAIL", true);
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
      commit("SET_LOADING_DETAIL", false);
    }
  },
  async createDepartment({ dispatch, commit }, payload) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.post("/departments", payload);
      // Sau khi tạo thành công, reload danh sách phòng ban
      await dispatch("fetchDepartments", { forceRefresh: true });
      return response.data;
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      commit("SET_LOADING", false);
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
