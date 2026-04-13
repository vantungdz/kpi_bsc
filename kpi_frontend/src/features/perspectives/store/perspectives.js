import apiClient from "@/core/services/api";

const state = {
  perspectives: [],
  error: null,
  loading: false,
};

const getters = {
  perspectiveList: (state) => state.perspectives,
  error: (state) => state.error,
  isLoading: (state) => state.loading,
};

const mutations = {
  SET_ERROR(state, error) {
    state.error = error ? error.response?.data?.message || error.message : null;
  },
  SET_LOADING(state, loading) {
    state.loading = loading;
  },
  SET_PERSPECTIVES(state, perspectives) {
    state.perspectives = perspectives || [];
  },
};

const actions = {
  /**
   * Lấy danh sách perspectives.
   */
  async fetchPerspectives({ commit }, params = {}) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.get("/perspectives", { params });
      commit("SET_PERSPECTIVES", response.data);
    } catch (error) {
      commit("SET_ERROR", error);
      commit("SET_PERSPECTIVES", []);
    } finally {
      commit("SET_LOADING", false);
    }
  },

  /**
   * Tạo mới perspective.
   */
  async createPerspective({ commit }, perspective) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      await apiClient.post("/perspectives", perspective);
    } catch (error) {
      commit("SET_ERROR", error);
    } finally {
      commit("SET_LOADING", false);
    }
  },

  /**
   * Cập nhật perspective.
   */
  async updatePerspective({ commit }, { id, perspective }) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      await apiClient.put(`/perspectives/${id}`, perspective);
    } catch (error) {
      commit("SET_ERROR", error);
    } finally {
      commit("SET_LOADING", false);
    }
  },

  /**
   * Xóa perspective.
   */
  async deletePerspective({ commit }, id) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      await apiClient.delete(`/perspectives/${id}`);
    } catch (error) {
      commit("SET_ERROR", error);
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
