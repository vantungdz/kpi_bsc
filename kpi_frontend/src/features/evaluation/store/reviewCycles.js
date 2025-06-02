import apiClient from "@/core/services/api";

const state = {
  cycles: [],
  error: null,
};

const getters = {
  getCycles: (state) => state.cycles,
  getCycleError: (state) => state.error,
};

const actions = {
  async fetchCycles({ commit }) {
    await store.dispatch("loading/startLoading");
    commit("SET_ERROR", null);
    try {
      const res = await apiClient.get("/review-cycles");
      commit("SET_CYCLES", res.data);
    } catch (e) {
      commit("SET_ERROR", e.message);
    } finally {
      await store.dispatch("loading/stopLoading");
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
