import apiClient from "@/core/services/api";

const state = {
  userList: [],
  usersBySection: {},
  usersByDepartment: {},
  loading: false,
  error: null,
};

const getters = {
  userList: (state) => state.userList,
  usersBySection: (state) => (sectionId) =>
    state.usersBySection[String(sectionId)] || [],
  usersByDepartment: (state) => (departmentId) =>
    state.usersByDepartment[String(departmentId)] || [],
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
  SET_USERS(state, users) {
    state.userList = users;
  },
  SET_USERS_BY_SECTION(state, { sectionId, users }) {
    const key = String(sectionId);
    state.usersBySection = {
      ...state.usersBySection,
      [key]: users,
    };
  },
  SET_USERS_BY_DEPARTMENT(state, { departmentId, users }) {
    const key = String(departmentId);
    state.usersByDepartment = {
      ...state.usersByDepartment,
      [key]: users,
    };
  },
};

const actions = {
  async fetchUsers({ commit, state }, params = {}) {
    const sectionIdParam = params.sectionId;
    const departmentIdParam = params.departmentId;

    const hasSectionIdParam =
      typeof sectionIdParam !== "undefined" &&
      sectionIdParam !== null &&
      sectionIdParam !== "";
    const hasDepartmentIdParam =
      typeof departmentIdParam !== "undefined" &&
      departmentIdParam !== null &&
      departmentIdParam !== "";
    if (
      hasSectionIdParam &&
      state.usersBySection[String(sectionIdParam)]?.length > 0
    ) {
      return state.usersBySection[String(sectionIdParam)];
    }

    if (
      hasDepartmentIdParam &&
      state.usersByDepartment[String(departmentIdParam)]?.length > 0
    ) {
      return state.usersByDepartment[String(departmentIdParam)];
    }

    const isGeneralFetch =
      !hasSectionIdParam &&
      !hasDepartmentIdParam &&
      Object.keys(params).length === 0;
    if (isGeneralFetch && state.userList.length > 0) {
      return state.userList;
    }

    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.get("/employees", { params });
      const fetchedUsers = response.data?.data || response.data || [];

      if (isGeneralFetch) {
        commit("SET_USERS", fetchedUsers);
      } else if (hasSectionIdParam) {
        commit("SET_USERS_BY_SECTION", {
          sectionId: sectionIdParam,
          users: fetchedUsers,
        });
      } else if (hasDepartmentIdParam) {
        commit("SET_USERS_BY_DEPARTMENT", {
          departmentId: departmentIdParam,
          users: fetchedUsers,
        });
      } else {
        console.warn(
          "fetchUsers action: API call with unexpected params, data not committed to specific state.",
          params
        );
      }

      return fetchedUsers;
    } catch (error) {
      console.error("Error fetching users:", error.response || error);
      commit("SET_ERROR", error);
      if (isGeneralFetch) {
        commit("SET_USERS", []);
      } else if (hasSectionIdParam) {
        commit("SET_USERS_BY_SECTION", {
          sectionId: sectionIdParam,
          users: [],
        });
      } else if (hasDepartmentIdParam) {
        commit("SET_USERS_BY_DEPARTMENT", {
          departmentId: departmentIdParam,
          users: [],
        });
      }
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  async fetchUsersBySection({ dispatch, state }, sectionId) {
    if (!sectionId) {
      return [];
    }
    if (state.usersBySection[String(sectionId)]?.length > 0) {
      return state.usersBySection[String(sectionId)];
    }
    return dispatch("fetchUsers", { sectionId: sectionId });
  },

  async fetchUsersByDepartment({ dispatch, state }, departmentId) {
    if (!departmentId) {
      return [];
    }
    if (state.usersByDepartment[String(departmentId)]?.length > 0) {
      return state.usersByDepartment[String(departmentId)];
    }
    return dispatch("fetchUsers", { departmentId: departmentId });
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
