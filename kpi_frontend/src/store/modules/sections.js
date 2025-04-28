import apiClient from "../../services/api";

const state = {
  sections: [],
  loading: false,
  error: null,
  sectionsByDepartment: {},
};

const getters = {
  sectionList: (state) => state.sections,
  isLoading: (state) => state.loading,
  error: (state) => state.error,
  sectionsByDepartment: (state) => (departmentId) =>
    state.sectionsByDepartment[departmentId] || [],
};

const mutations = {
  SET_LOADING(state, isLoading) {
    state.loading = isLoading;
  },
  SET_ERROR(state, error) {
    state.error = error ? error.response?.data?.message || error.message : null;
  },
  SET_SECTIONS(state, sectionsData) {
    state.sections = sectionsData?.data || sectionsData || [];
  },
  SET_SECTIONS_BY_DEPARTMENT(state, { departmentId, sections }) {
    const key = String(departmentId);
    state.sectionsByDepartment = {
      ...state.sectionsByDepartment,
      [key]: sections?.data || sections || [],
    };
  },
};

const actions = {
  async fetchSections(
    { commit, state },
    { params = {}, forceRefresh = false } = {}
  ) {
    const hasDepartmentIdParam =
      typeof params.department_id !== "undefined" &&
      params.department_id !== null &&
      params.department_id !== "";

    if (
      hasDepartmentIdParam &&
      state.sectionsByDepartment[String(params.department_id)] &&
      !forceRefresh
    ) {
      return state.sectionsByDepartment[String(params.department_id)];
    }

    if (!hasDepartmentIdParam && state.sections.length > 0 && !forceRefresh) {
      return state.sections;
    }

    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.get("/sections", { params });
      const fetchedSections = response.data?.data || response.data || [];

      if (!hasDepartmentIdParam) {
        commit("SET_SECTIONS", fetchedSections);
      } else {
        commit("SET_SECTIONS_BY_DEPARTMENT", {
          departmentId: params.department_id,
          sections: fetchedSections,
        });
      }

      return fetchedSections;
    } catch (error) {
      console.error("Error fetching sections:", error.response || error);
      commit("SET_ERROR", error);
      if (!hasDepartmentIdParam) {
        commit("SET_SECTIONS", []);
      }
      if (hasDepartmentIdParam) {
        commit("SET_SECTIONS_BY_DEPARTMENT", {
          departmentId: params.department_id,
          sections: [],
        });
      }
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  async fetchSectionsByDepartment({ dispatch, state }, departmentId) {
    if (!departmentId) {
      return Promise.resolve([]);
    }

    if (state.sectionsByDepartment[String(departmentId)]) {
      return Promise.resolve(state.sectionsByDepartment[String(departmentId)]);
    }
    return dispatch("fetchSections", {
      params: { department_id: departmentId },
    });
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
