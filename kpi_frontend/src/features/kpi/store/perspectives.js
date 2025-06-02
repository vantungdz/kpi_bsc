import apiClient from "@/core/services/api";
import store from "@/core/store";

const state = {
  perspectives: [], // Danh sách perspectives
  error: null, // Lỗi khi tải hoặc xử lý perspectives
};

const getters = {
  // --- Dữ liệu ---
  perspectiveList: (state) => state.perspectives,

  // --- Trạng thái lỗi ---
  error: (state) => state.error,
};

const mutations = {
  // --- Trạng thái lỗi ---
  SET_ERROR(state, error) {
    state.error = error ? error.response?.data?.message || error.message : null;
  },

  // --- Dữ liệu ---
  SET_PERSPECTIVES(state, perspectives) {
    state.perspectives = perspectives || [];
  },

  // --- Trạng thái loading ---
  // Không còn mutation `SET_LOADING` vì trạng thái loading được quản lý toàn cục
};

const actions = {
  /**
   * Lấy danh sách perspectives.
   */
  async fetchPerspectives({ commit }, params = {}) {
    await store.dispatch("loading/startLoading");
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.get("/perspectives", { params });
      commit("SET_PERSPECTIVES", response.data);
    } catch (error) {
      commit("SET_ERROR", error);
      commit("SET_PERSPECTIVES", []);
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
