import apiClient from "@/core/services/api";

const state = {
  sections: [],
  loading: false,
  error: null,
  sectionsByDepartment: {},
  // loadingDetail: false, // Đã có trong file bạn cung cấp, tốt!
  // detailError: null,    // Đã có trong file bạn cung cấp, tốt!
};

const getters = {
  sectionList: (state) => state.sections,
  isLoading: (state) => state.loading,
  error: (state) => state.error,
  sectionsByDepartment: (state) => (departmentId) =>
    state.sectionsByDepartment[departmentId] || [],
  // isLoadingDetail: (state) => state.loadingDetail, // Đã có
  // getDetailError: (state) => state.detailError,    // Đã có
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
  SET_LOADING_DETAIL(state, isLoading) {
    // Đã có
    state.loadingDetail = isLoading;
  },
  SET_DETAIL_ERROR(state, error) {
    // Đã có
    state.detailError = error;
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

  async fetchSectionById({ commit }, sectionId) {
    if (!sectionId) {
      commit("SET_DETAIL_ERROR", "Section ID is required to fetch details.");
      return null;
    }
    commit("SET_LOADING_DETAIL", true);
    commit("SET_DETAIL_ERROR", null);
    try {
      // Giả sử API của bạn là GET /sections/:id
      const response = await apiClient.get(`/sections/${sectionId}`);
      // Bạn có thể commit vào state nếu muốn lưu chi tiết section hiện tại
      // commit("SET_CURRENT_SECTION_DETAIL", response.data);
      return response.data; // Trả về dữ liệu chi tiết của section
    } catch (error) {
      console.error(
        `Error fetching section by ID ${sectionId}:`,
        error.response || error
      );
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch section details.";
      commit("SET_DETAIL_ERROR", errorMsg);
      // Không ném lỗi ở đây để component ReviewHistoryPage có thể xử lý fallback tên
      return null;
    } finally {
      commit("SET_LOADING_DETAIL", false);
    }
  },

  async createSection({ dispatch }, payload) {
    // payload: { name, departmentId, managerId }
    const res = await apiClient.post("/sections", {
      name: payload.name,
      departmentId: payload.departmentId,
      managerId: payload.managerId,
    });
    // Refresh list after creation
    await dispatch("fetchSections", { forceRefresh: true });
    return res.data;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
