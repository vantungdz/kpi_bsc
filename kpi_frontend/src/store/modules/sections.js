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
    console.log("MUTATION SET_SECTIONS called with data:", sectionsData);
    state.sections = sectionsData?.data || sectionsData || [];
  },
  SET_SECTIONS_BY_DEPARTMENT(state, { departmentId, sections }) {
    const key = String(departmentId);
    state.sectionsByDepartment = {
      ...state.sectionsByDepartment,
      [key]: sections?.data || sections || [],
    };
    console.log(
      `MUTATION SET_SECTIONS_BY_DEPARTMENT called for department ${departmentId}. State updated.`
    );
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
      console.log(
        `WorkspaceSections: Sections for department ${params.department_id} already in state. Returning.`
      );
      return state.sectionsByDepartment[String(params.department_id)];
    }

    if (!hasDepartmentIdParam && state.sections.length > 0 && !forceRefresh) {
      console.log(
        "fetchSections: No fetch needed (general sections). Returning."
      );
      return state.sections;
    }

    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      console.log("Calling API: GET /sections with params:", params);
      const response = await apiClient.get("/sections", { params });
      const fetchedSections = response.data?.data || response.data || [];
      console.log("API Response for sections:", response.data);

      if (!hasDepartmentIdParam) {
        console.log("Committing SET_SECTIONS (no department_id param).");
        commit("SET_SECTIONS", fetchedSections);
      } else {
        console.log(
          `Committing SET_SECTIONS_BY_DEPARTMENT for department ${params.department_id}.`
        );
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
      console.warn("fetchSectionsByDepartment: departmentId is required.");

      return Promise.resolve([]);
    }

    if (state.sectionsByDepartment[String(departmentId)]) {
      console.log(
        `WorkspaceSectionsByDepartment: Sections for department ${departmentId} already in state.`
      );
      return Promise.resolve(state.sectionsByDepartment[String(departmentId)]);
    }

    console.log(
      `WorkspaceSectionsByDepartment: Fetching sections for department ${departmentId}.`
    );
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
