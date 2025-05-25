import apiClient from "@/core/services/api";

const state = {
  cycles: [],
  isLoading: false,
  error: null,
};

const getters = {
  getCycles: (state) => state.cycles,
  isLoadingCycles: (state) => state.isLoading,
  getCycleError: (state) => state.error,
};

const actions = {
  async fetchCycles({ commit }) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      const res = await apiClient.get("/review-cycles");
      commit("SET_CYCLES", res.data);
    } catch (e) {
      commit("SET_ERROR", e.message);
    } finally {
      commit("SET_LOADING", false);
    }
  },
  async addCycle({ dispatch }, name) {
    await apiClient.post("/review-cycles", { name });
    await dispatch("fetchCycles");
  },
  async updateCycle({ dispatch }, { id, name }) {
    await apiClient.put(`/review-cycles/${id}`, { name });
    await dispatch("fetchCycles");
  },
  async deleteCycle({ dispatch }, id) {
    await apiClient.delete(`/review-cycles/${id}`);
    await dispatch("fetchCycles");
  },
};

const mutations = {
  SET_CYCLES(state, data) {
    state.cycles = data;
  },
  SET_LOADING(state, isLoading) {
    state.isLoading = isLoading;
  },
  SET_ERROR(state, error) {
    state.error = error;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
