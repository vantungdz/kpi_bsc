import apiClient from "@/core/services/api";

const state = {
  goals: [],
  loading: false,

  goalsByEmployee: {},

  _lastEmployeeId: null,
};

const getters = {
  personalGoals: (state) => state.goals,
  personalGoalLoading: (state) => state.loading,

  employeeGoalList: (state) =>
    state._lastEmployeeId
      ? state.goalsByEmployee[state._lastEmployeeId] || []
      : [],
};

const actions = {
  async fetchPersonalGoals({ commit, dispatch }) {
    dispatch("loading/startLoading", null, { root: true });
    try {
      const res = await apiClient.get("/personal-goals/my");
      commit("setGoals", res.data);
    } finally {
      dispatch("loading/stopLoading", null, { root: true });
    }
  },
  async addPersonalGoal({ dispatch }, payload) {
    dispatch("loading/startLoading", null, { root: true });
    try {
      await apiClient.post("/personal-goals", payload);
      await dispatch("fetchPersonalGoals");
    } finally {
      dispatch("loading/stopLoading", null, { root: true });
    }
  },
  async updatePersonalGoal({ dispatch }, { id, data }) {
    dispatch("loading/startLoading", null, { root: true });
    try {
      await apiClient.patch(`/personal-goals/${id}`, data);
      await dispatch("fetchPersonalGoals");
    } finally {
      dispatch("loading/stopLoading", null, { root: true });
    }
  },
  async deletePersonalGoal({ dispatch }, id) {
    dispatch("loading/startLoading", null, { root: true });
    try {
      await apiClient.delete(`/personal-goals/${id}`);
      await dispatch("fetchPersonalGoals");
    } finally {
      dispatch("loading/stopLoading", null, { root: true });
    }
  },
  async fetchGoalsByEmployee({ commit, state }, { employeeId }) {
    commit("setLoading", true);
    try {
      const res = await apiClient.get("/personal-goals", {
        params: { employeeId },
      });
      commit("setGoalsByEmployee", { employeeId, goals: res.data });

      state._lastEmployeeId = employeeId;
    } catch (err) {
      commit("setGoalsByEmployee", { employeeId, goals: [] });
      state._lastEmployeeId = employeeId;
      throw err;
    } finally {
      commit("setLoading", false);
    }
  },
};

const mutations = {
  setGoals(state, goals) {
    state.goals = goals;
  },
  setLoading(state, loading) {
    state.loading = loading;
  },
  setGoalsByEmployee(state, { employeeId, goals }) {
    state.goalsByEmployee = {
      ...state.goalsByEmployee,
      [employeeId]: goals,
    };
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
