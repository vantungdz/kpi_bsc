import apiClient from "@/core/services/api";

const state = {
  roles: [],
  loading: false,
  error: null,
};

const getters = {
  roleList: (state) => state.roles,
  isLoading: (state) => state.loading,
  error: (state) => state.error,
};

const mutations = {
  SET_ROLES(state, roles) {
    state.roles = roles;
  },
  SET_LOADING(state, loading) {
    state.loading = loading;
  },
  SET_ERROR(state, error) {
    state.error = error ? error.response?.data?.message || error.message : null;
  },
};

const actions = {
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
  async createRole({ dispatch, commit }, payload) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      await apiClient.post("/roles", payload);
      await dispatch("fetchRoles", { forceRefresh: true });
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },
  async updateRole({ dispatch, commit }, { id, ...payload }) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      await apiClient.patch(`/roles/${id}`, payload);
      await dispatch("fetchRoles", { forceRefresh: true });
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },
  async deleteRole({ dispatch, commit }, id) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      await apiClient.delete(`/roles/${id}`);
      await dispatch("fetchRoles", { forceRefresh: true });
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
