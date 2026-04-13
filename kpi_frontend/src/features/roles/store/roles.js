import apiClient from "@/core/services/api";
import store from "@/core/store";

const state = {
  roles: [],
  error: null,
  loading: false,
};

const getters = {
  roleList: (state) => state.roles,
  error: (state) => state.error,
  isLoading: (state) => state.loading,
};

const mutations = {
  SET_ROLES(state, roles) {
    state.roles = roles || [];
  },
  SET_ERROR(state, error) {
    state.error = error ? error.response?.data?.message || error.message : null;
  },
  SET_LOADING(state, loading) {
    state.loading = loading;
  },
};

const actions = {
  /**
   * Lấy danh sách roles.
   */
  async fetchRoles({ commit }) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      const res = await apiClient.get("/roles");
      commit("SET_ROLES", res.data);
    } catch (error) {
      commit("SET_ERROR", error);
      commit("SET_ROLES", []);
    } finally {
      commit("SET_LOADING", false);
    }
  },

  /**
   * Tạo mới một role.
   */
  async createRole({ dispatch, commit }, payload) {
    await store.dispatch("loading/startLoading");
    commit("SET_ERROR", null);
    try {
      await apiClient.post("/roles", payload);
      await dispatch("fetchRoles", { forceRefresh: true });
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  /**
   * Cập nhật một role.
   */
  async updateRole({ dispatch, commit }, { id, ...payload }) {
    await store.dispatch("loading/startLoading");
    commit("SET_ERROR", null);
    try {
      await apiClient.patch(`/roles/${id}`, payload);
      await dispatch("fetchRoles", { forceRefresh: true });
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  /**
   * Xóa một role.
   */
  async deleteRole({ dispatch, commit }, id) {
    await store.dispatch("loading/startLoading");
    commit("SET_ERROR", null);
    try {
      await apiClient.delete(`/roles/${id}`);
      await dispatch("fetchRoles", { forceRefresh: true });
    } catch (error) {
      commit("SET_ERROR", error);
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
