import apiClient from "../../services/api";

const state = {
  departments: [],
  loading: false,
  error: null,
};

const getters = {
  departmentList: (state) => state.departments,
  isLoading: (state) => state.loading,
  error: (state) => state.error,
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
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
