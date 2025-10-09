import apiClient from "@/core/services/api";
import store from "@/core/store";

const state = {
  roles: [],
  error: null,
};

const getters = {
  roleList: (state) => state.roles,

  error: (state) => state.error,
};

const mutations = {
  SET_ROLES(state, roles) {
    state.roles = roles || [];
  },

  SET_ERROR(state, error) {
    state.error = error ? error.response?.data?.message || error.message : null;
  },
};

const actions = {
  /**
   * Lấy danh sách roles.
   */
  async fetchRoles({ commit }) {
    await store.dispatch("loading/startLoading");
    commit("SET_ERROR", null);
    try {
      const res = await apiClient.get("/roles");
      commit("SET_ROLES", res.data);
    } catch (error) {
      commit("SET_ERROR", error);
      commit("SET_ROLES", []);
    } finally {
      await store.dispatch("loading/stopLoading");
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
