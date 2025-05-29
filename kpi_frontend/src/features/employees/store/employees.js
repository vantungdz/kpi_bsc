import apiClient from "@/core/services/api";

const state = {
  userList: [],
  usersBySection: {},
  usersByDepartment: {},
  loading: false,
  loadingDetail: false, // Thêm state cho loading user detail
  error: null,
};

const getters = {
  userList: (state) => state.userList,
  usersBySection: (state) => (sectionId) =>
    state.usersBySection[String(sectionId)] || [],
  usersByDepartment: (state) => (departmentId) =>
    state.usersByDepartment[String(departmentId)] || [],
  isLoading: (state) => state.loading,
  isLoadingDetail: (state) => state.loadingDetail, // Getter mới
  error: (state) => state.error,
};

const mutations = {
  SET_LOADING(state, isLoading) {
    state.loading = isLoading;
  },
  SET_LOADING_DETAIL(state, isLoading) {
    // Mutation mới
    state.loadingDetail = isLoading;
  },
  SET_ERROR(state, error) {
    state.error = error ? error.response?.data?.message || error.message : null;
  },
  SET_USERS(state, users) {
    state.userList = users || [];
  },
  SET_USERS_BY_SECTION(state, { sectionId, users }) {
    const key = String(sectionId);
    state.usersBySection = {
      ...state.usersBySection,
      [key]: users || [],
    };
  },
  SET_USERS_BY_DEPARTMENT(state, { departmentId, users }) {
    const key = String(departmentId);
    state.usersByDepartment = {
      ...state.usersByDepartment,
      [key]: users || [],
    };
  },
};

const actions = {
  async fetchUsers({ commit, state }, params = {}) {
    const { sectionId, departmentId, force = false } = params;

    const hasSectionIdParam =
      typeof sectionId !== "undefined" &&
      sectionId !== null &&
      sectionId !== "";
    const hasDepartmentIdParam =
      typeof departmentId !== "undefined" &&
      departmentId !== null &&
      departmentId !== "";

    if (!force) {
      if (
        hasSectionIdParam &&
        state.usersBySection[String(sectionId)]?.length > 0
      ) {
        return state.usersBySection[String(sectionId)];
      }
      if (
        hasDepartmentIdParam &&
        state.usersByDepartment[String(departmentId)]?.length > 0
      ) {
        return state.usersByDepartment[String(departmentId)];
      }
    }

    const apiParamsForCheck = { ...params };
    delete apiParamsForCheck.force;
    const isGeneralFetch =
      !hasSectionIdParam &&
      !hasDepartmentIdParam &&
      Object.keys(apiParamsForCheck).length === 0;

    if (!force && isGeneralFetch && state.userList.length > 0) {
      return state.userList;
    }

    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      const apiParams = { ...params };
      delete apiParams.force;

      const response = await apiClient.get("/employees", { params: apiParams });
      const fetchedUsers = response.data?.data || response.data || [];

      if (isGeneralFetch) {
        commit("SET_USERS", fetchedUsers);
      } else if (hasSectionIdParam) {
        commit("SET_USERS_BY_SECTION", {
          sectionId: sectionId,
          users: fetchedUsers,
        });
      } else if (hasDepartmentIdParam) {
        commit("SET_USERS_BY_DEPARTMENT", {
          departmentId: departmentId,
          users: fetchedUsers,
        });
      }
      return fetchedUsers;
    } catch (error) {
      console.error("Error fetching users:", error.response || error);
      commit("SET_ERROR", error);
      if (isGeneralFetch) commit("SET_USERS", []);
      else if (hasSectionIdParam)
        commit("SET_USERS_BY_SECTION", { sectionId: sectionId, users: [] });
      else if (hasDepartmentIdParam)
        commit("SET_USERS_BY_DEPARTMENT", {
          departmentId: departmentId,
          users: [],
        });
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

  async fetchUserById({ commit }, userId) {
    if (!userId) {
      commit("SET_ERROR", "User ID is required to fetch details.");
      return null;
    }
    commit("SET_LOADING_DETAIL", true);
    commit("SET_ERROR", null);
    try {
      // Giả sử API của bạn là GET /employees/:id
      const response = await apiClient.get(`/employees/${userId}`);
      return response.data; // Trả về dữ liệu chi tiết của user
    } catch (error) {
      console.error(
        `Error fetching user by ID ${userId}:`,
        error.response || error
      );
      commit("SET_ERROR", error);
      throw error; // Ném lỗi để component có thể bắt
    } finally {
      commit("SET_LOADING_DETAIL", false);
    }
  },

  async uploadFile({ commit, dispatch }, file) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await apiClient.post("/employees/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await dispatch("fetchUsers", { force: true });
      return response.data;
    } catch (error) {
      console.error("Error uploading employee Excel:", error.response || error);
      commit("SET_ERROR", error);
      throw error.response?.data || error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  async updateUserRole({ commit, dispatch }, { id, role }) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      // role là entity name
      await apiClient.patch(`/employees/${id}/role`, { role });
      await dispatch("fetchUsers", { force: true });
      return true;
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  async updateUserRoles({ commit, dispatch }, { id, roles }) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      await apiClient.patch(`/employees/${id}/roles`, { roles });
      await dispatch("fetchUsers", { force: true });
      return true;
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  async resetPassword({ commit, dispatch }, { id, newPassword } = {}) {
    if (!id) throw new Error("User ID is required to reset password.");
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.patch(
        `/employees/${id}/reset-password`,
        newPassword ? { newPassword } : {}
      );
      await dispatch("fetchUsers", { force: true });
      return response.data; // Trả về employee đã reset
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  async deleteEmployee({ commit, dispatch }, id) {
    if (!id) throw new Error("User ID is required to delete employee.");
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      await apiClient.delete(`/employees/${id}`);
      await dispatch("fetchUsers", { force: true });
      return true;
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  async updateEmployee({ commit, dispatch }, updateDto) {
    if (!updateDto || !updateDto.id)
      throw new Error("User ID is required to update employee.");
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      // Đảm bảo chỉ truyền role là entity name (string)
      let payload = { ...updateDto };
      if (payload.role && typeof payload.role === "object") {
        payload.role = payload.role.name;
      }
      const response = await apiClient.patch(
        `/employees/${payload.id}`,
        payload
      );
      await dispatch("fetchUsers", { force: true });
      return response.data;
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  async createEmployee({ commit, dispatch }, createDto) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      // Đảm bảo chỉ truyền role là entity name (string)
      let payload = { ...createDto };
      if (payload.role && typeof payload.role === "object") {
        payload.role = payload.role.name;
      }
      const response = await apiClient.post("/employees", payload);
      await dispatch("fetchUsers", { force: true });
      return response.data;
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  // --- RBAC Role/Permission Management ---
  async fetchRolesWithPermissions({ commit }) {
    try {
      const res = await apiClient.get("/roles/with-permissions");
      return res.data;
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    }
  },
  async fetchAllPermissions({ commit }) {
    try {
      const res = await apiClient.get("/roles/permissions");
      return res.data;
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    }
  },
  async updateRolePermissions({ commit }, { roleId, permissionIds }) {
    try {
      await apiClient.patch(`/roles/${roleId}/permissions`, { permissionIds });
      return true;
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    }
  },

  async fetchEmployeePerformanceHistory({ commit }, { employeeId, fromYear, toYear }) {
    if (!employeeId) return [];
    commit('SET_LOADING', true);
    commit('SET_ERROR', null);
    try {
      const response = await apiClient.get(`/employees/${employeeId}/performance-history`, {
        params: { fromYear, toYear },
      });
      // Không lưu vào state chung vì dữ liệu này dạng động, trả về luôn
      return response.data || [];
    } catch (error) {
      commit('SET_ERROR', error);
      throw error;
    } finally {
      commit('SET_LOADING', false);
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
