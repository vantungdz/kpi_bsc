import apiClient from "@/core/services/api";
import store from "@/core/store";

const state = {
  sections: [], // Danh sách các sections
  error: null, // Lỗi khi tải hoặc xử lý sections
  sectionsByDepartment: {}, // Danh sách sections theo department
  detailError: null, // Lỗi khi tải chi tiết section
};

const getters = {
  // --- Dữ liệu ---
  sectionList: (state) => state.sections,
  sectionsByDepartment: (state) => (departmentId) =>
    state.sectionsByDepartment[departmentId] || [],

  // --- Trạng thái lỗi ---
  error: (state) => state.error,
  detailError: (state) => state.detailError,

  // --- Trạng thái loading ---
  // Không còn getter `isLoading` và `isLoadingDetail` vì trạng thái loading được quản lý toàn cục
};

const mutations = {
  // --- Trạng thái lỗi ---
  SET_ERROR(state, error) {
    state.error = error ? error.response?.data?.message || error.message : null;
  },
  SET_DETAIL_ERROR(state, error) {
    state.detailError = error
      ? error.response?.data?.message || error.message
      : null;
  },

  // --- Dữ liệu ---
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

  // --- Trạng thái loading ---
  // Không còn mutation `SET_LOADING` và `SET_LOADING_DETAIL` vì trạng thái loading được quản lý toàn cục
};

const actions = {
  /**
   * Lấy danh sách sections.
   */
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

    await store.dispatch("loading/startLoading");
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
      await store.dispatch("loading/stopLoading");
    }
  },

  /**
   * Lấy danh sách sections theo department.
   */
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

  /**
   * Lấy chi tiết section theo ID.
   */
  async fetchSectionById({ commit }, sectionId) {
    if (!sectionId) {
      commit("SET_DETAIL_ERROR", "Section ID is required to fetch details.");
      return null;
    }

    await store.dispatch("loading/startLoading");
    commit("SET_DETAIL_ERROR", null);
    try {
      const response = await apiClient.get(`/sections/${sectionId}`);
      return response.data;
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
      return null;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  /**
   * Tạo mới một section.
   */
  async createSection({ dispatch }, payload) {
    await store.dispatch("loading/startLoading");
    try {
      const res = await apiClient.post("/sections", {
        name: payload.name,
        departmentId: payload.departmentId,
        managerId: payload.managerId,
      });
      await dispatch("fetchSections", { forceRefresh: true });
      return res.data;
    } catch (error) {
      console.error("Error creating section:", error.response || error);
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  /**
   * Cập nhật một section.
   */
  async updateSection({ dispatch }, { id, data }) {
    await store.dispatch("loading/startLoading");
    try {
      const res = await apiClient.put(`/sections/${id}`, data);
      await dispatch("fetchSections", { forceRefresh: true });
      return res.data;
    } catch (error) {
      console.error("Error updating section:", error.response || error);
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  /**
   * Xóa một section.
   */
  async deleteSection({ dispatch, commit }, id) {
    await store.dispatch("loading/startLoading");
    try {
      await apiClient.delete(`/sections/${id}`);
      await dispatch("fetchSections", { forceRefresh: true });
      return true;
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error.message ||
        "Xóa section thất bại";
      commit("SET_ERROR", msg);
      throw new Error(msg);
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
