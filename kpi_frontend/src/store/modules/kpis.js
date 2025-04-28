import apiClient from "../../services/api";
import { notification } from "ant-design-vue";

const state = {
  kpis: [],
  kpisAllForSelect: [],
  sectionKpiList: [],
  departmentKpiList: [],
  currentKpi: null,

  currentKpiUserAssignments: [],
  loadingUserAssignments: false,
  userAssignmentError: null,

  myAssignments: [],
  loadingMyAssignments: false,
  myAssignmentsError: null,

  submittingUpdate: false,
  submitUpdateError: null,

  submittingDepartmentSectionAssignment: false,
  departmentSectionAssignmentSaveError: null,

  submittingDepartmentSectionDeletion: false,
  departmentSectionDeletionError: null,

  submittingUserDeletion: false,
  userDeletionError: null,

  loading: false,
  loadingAll: false,
  error: null,

  pagination: {
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    itemsPerPage: 10,
  },
};

const getters = {
  kpiList: (state) => state.kpis,
  kpiListAll: (state) => state.kpisAllForSelect,
  sectionKpiList: (state) => state.sectionKpiList,
  departmentKpiList: (state) => state.departmentKpiList,
  currentKpi: (state) => state.currentKpi,

  currentKpiUserAssignments: (state) => state.currentKpiUserAssignments,
  isLoadingUserAssignments: (state) => state.loadingUserAssignments,
  userAssignmentError: (state) => state.userAssignmentError,

  myAssignments: (state) => state.myAssignments,
  isLoadingMyAssignments: (state) => state.loadingMyAssignments,
  myAssignmentsError: (state) => state.myAssignmentsError,

  isSubmittingUpdate: (state) => state.submittingUpdate,
  submitUpdateError: (state) => state.submitUpdateError,

  isSubmittingDepartmentSectionAssignment: (state) =>
    state.submittingDepartmentSectionAssignment,
  departmentSectionAssignmentSaveError: (state) =>
    state.departmentSectionAssignmentSaveError,

  isSubmittingDepartmentSectionDeletion: (state) =>
    state.submittingDepartmentSectionDeletion,
  departmentSectionDeletionError: (state) =>
    state.departmentSectionDeletionError,

  isSubmittingUserDeletion: (state) => state.submittingUserDeletion,
  userDeletionError: (state) => state.userDeletionError,

  isLoading: (state) => state.loading,
  error: (state) => state.error,
  pagination: (state) => state.pagination,
};

const mutations = {
  SET_LOADING(state, isLoading) {
    state.loading = isLoading;
  },
  SET_LOADING_ALL(state, isLoading) {
    state.loadingAll = isLoading;
  },
  SET_ERROR(state, error) {
    state.error = error
      ? error.response?.data?.message ||
        error.message ||
        "An unknown error occurred"
      : null;
  },

  SET_USER_ASSIGNMENT_LOADING(state, isLoading) {
    state.loadingUserAssignments = isLoading;
  },
  SET_USER_ASSIGNMENT_ERROR(state, error) {
    state.userAssignmentError = error
      ? error.response?.data?.message ||
        error.message ||
        "An assignment fetch error occurred"
      : null;
  },
  SET_KPI_USER_ASSIGNMENTS(state, assignments) {
    console.log("MUTATION SET_KPI_USER_ASSIGNMENTS called with:", assignments);
    state.currentKpiUserAssignments = [...(assignments || [])];
    console.log(
      "MUTATION SET_KPI_USER_ASSIGNMENTS state after update:",
      state.currentKpiUserAssignments
    );
  },

  SET_MY_ASSIGNMENTS_LOADING(state, isLoading) {
    state.loadingMyAssignments = isLoading;
  },
  SET_MY_ASSIGNMENTS_ERROR(state, error) {
    state.myAssignmentsError = error
      ? error.response?.data?.message || error.message
      : null;
  },
  SET_MY_ASSIGNMENTS(state, assignments) {
    state.myAssignments = assignments || [];
  },

  SET_SUBMIT_UPDATE_LOADING(state, isLoading) {
    state.submittingUpdate = isLoading;
  },
  SET_SUBMIT_UPDATE_ERROR(state, error) {
    state.submitUpdateError = error
      ? error.response?.data?.message || error.message
      : null;
  },

  SET_SUBMITTING_DEPARTMENT_SECTION_ASSIGNMENT(state, isLoading) {
    state.submittingDepartmentSectionAssignment = isLoading;
  },
  SET_DEPARTMENT_SECTION_ASSIGNMENT_SAVE_ERROR(state, error) {
    state.departmentSectionAssignmentSaveError = error
      ? error.response?.data?.message ||
        error.message ||
        "An error occurred while saving assignment."
      : null;
  },

  SET_SUBMITTING_DEPARTMENT_SECTION_DELETION(state, isLoading) {
    state.submittingDepartmentSectionDeletion = isLoading;
  },
  SET_DEPARTMENT_SECTION_DELETION_ERROR(state, error) {
    state.departmentSectionDeletionError = error
      ? error.response?.data?.message ||
        error.message ||
        "An unknown deletion error occurred"
      : null;
  },

  SET_SUBMITTING_USER_DELETION(state, isLoading) {
    state.submittingUserDeletion = isLoading;
  },
  SET_USER_DELETION_ERROR(state, error) {
    state.userDeletionError = error
      ? error.response?.data?.message ||
        error.message ||
        "An error occurred while deleting user assignment."
      : null;
  },

  SET_KPIS(state, kpiData) {
    state.kpis = kpiData?.data?.data || [];
    state.pagination = {
      currentPage: kpiData?.data?.pagination?.currentPage || 1,
      totalPages: kpiData?.data?.pagination?.totalPages || 0,
      totalItems: kpiData?.data?.pagination?.totalItems || 0,
      itemsPerPage: kpiData?.data?.pagination?.itemsPerPage || 10,
    };
  },

  SET_SECTION_KPIS(state, resData) {
    state.sectionKpiList = resData ? resData.data : [];
  },
  SET_DEPARTMENT_KPI_LIST(state, resData) {
    state.departmentKpiList = resData;
  },

  SET_KPIS_ALL_FOR_SELECT(state, kpis) {
    state.kpisAllForSelect = kpis?.data || kpis || [];
  },
  SET_CURRENT_KPI(state, kpi) {
    console.log("MUTATION SET_CURRENT_KPI called with:", kpi);
    state.currentKpi = kpi;

    state.currentKpiUserAssignments = [];
  },
  ADD_KPI(state, kpi) {
    if (!kpi) return;
    state.kpis.unshift(kpi);
    state.pagination.totalItems++;

    state.kpisAllForSelect.unshift({
      id: kpi.id,
      name: kpi.name,
      path: kpi.path,
    });
  },
  UPDATE_KPI(state, updatedKpi) {
    if (!updatedKpi) return;

    const index = state.kpis.findIndex((k) => k.id === updatedKpi.id);
    if (index !== -1) state.kpis.splice(index, 1, updatedKpi);

    const indexAll = state.kpisAllForSelect.findIndex(
      (k) => k.id === updatedKpi.id
    );
    if (indexAll !== -1)
      state.kpisAllForSelect.splice(indexAll, 1, {
        id: updatedKpi.id,
        name: updatedKpi.name,
        path: updatedKpi.path,
      });

    if (state.currentKpi && state.currentKpi.id === updatedKpi.id) {
      state.currentKpi = { ...state.currentKpi, ...updatedKpi };
    }
  },
  REMOVE_KPI(state, kpiId) {
    state.kpis = state.kpis.filter((k) => k.id !== kpiId);

    state.kpisAllForSelect = state.kpisAllForSelect.filter(
      (k) => k.id !== kpiId
    );

    if (state.pagination.totalItems > 0) state.pagination.totalItems--;

    if (state.currentKpi && state.currentKpi.id === kpiId) {
      state.currentKpi = null;
    }
  },
};

const actions = {
  async fetchKpis({ commit }, params = {}) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.get("/kpis", { params });
      commit("SET_KPIS", response);
      return response;
    } catch (error) {
      commit("SET_ERROR", error);
      commit("SET_KPIS", null);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  async fetchSectionKpis({ commit }, filterParams) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    commit("SET_SECTION_KPIS", null);

    try {
      const sectionIdInPath = filterParams.sectionId;

      const queryParams = { ...filterParams };
      delete queryParams.sectionId;

      console.log(
        "DEBUG ACTION fetchSectionKpis: filterParams nhận được:",
        filterParams
      );
      console.log(
        "DEBUG ACTION fetchSectionKpis: Giá trị sectionIdInPath:",
        sectionIdInPath,
        typeof sectionIdInPath
      );
      const url = `/kpis/sections/${sectionIdInPath}`;
      console.log("DEBUG ACTION fetchSectionKpis: URL được xây dựng:", url);
      console.log(
        "DEBUG ACTION fetchSectionKpis: Query Parameters sẽ gửi:",
        queryParams
      );

      console.log(
        "ACTION fetchSectionKpis: Gọi API GET",
        url,
        "với params:",
        queryParams
      );

      const response = await apiClient.get(url, {
        params: queryParams,
      });

      commit("SET_SECTION_KPIS", response.data);
      console.log(
        "ACTION fetchSectionKpis: Dữ liệu nhận được và commit:",
        response.data
      );

      return response.data;
    } catch (error) {
      console.error(
        "ACTION fetchSectionKpis: Lỗi khi fetch section KPIs:",
        error.response || error
      );
      commit("SET_ERROR", error);
      commit("SET_SECTION_KPIS", null);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  async fetchDepartmentKpis({ commit }, id) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    commit("SET_DEPARTMENT_KPI_LIST", null);
    try {
      const response = await apiClient.get(`/kpis/departments/${id}`);
      commit("SET_DEPARTMENT_KPI_LIST", response.data);
      return response.data;
    } catch (error) {
      commit("SET_ERROR", error);
      commit("SET_DEPARTMENT_KPI_LIST", null);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  async fetchAllKpisForSelect({ commit, state }, forceRefresh = false) {
    if (state.kpisAllForSelect.length > 0 && !forceRefresh)
      return state.kpisAllForSelect;
    commit("SET_LOADING_ALL", true);
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.get("/kpis", {
        params: { limit: 1000, fields: "id,name,path" },
      });
      const kpis = response.data?.data || response.data || [];
      commit("SET_KPIS_ALL_FOR_SELECT", kpis);
      return kpis;
    } catch (error) {
      commit("SET_ERROR", error);
      commit("SET_KPIS_ALL_FOR_SELECT", []);
      throw error;
    } finally {
      commit("SET_LOADING_ALL", false);
    }
  },

  async fetchKpiDetail({ commit }, id) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    commit("SET_USER_ASSIGNMENT_LOADING", false);
    commit("SET_USER_ASSIGNMENT_ERROR", null);

    commit("SET_CURRENT_KPI", null);
    try {
      console.log(`ACTION fetchKpiDetail: Calling API GET /kpis/${id}`);
      const response = await apiClient.get(`/kpis/${id}`);
      console.log("ACTION fetchKpiDetail: API response received:", response);

      const kpi = response.data;
      if (!kpi) {
        console.error(
          "ACTION fetchKpiDetail: response.data is null or undefined",
          response
        );
        throw new Error("Invalid KPI detail response format");
      }
      console.log(
        "ACTION fetchKpiDetail: Committing response.data (assuming it's the KPI object):",
        kpi
      );

      commit("SET_CURRENT_KPI", kpi);
      return kpi;
    } catch (error) {
      console.error("Error fetching KPI detail:", error.response || error);
      commit("SET_ERROR", error);
      commit("SET_CURRENT_KPI", null);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  async createKpi({ commit }, kpiData) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.post("/kpis/createKpi", kpiData);

      commit("ADD_KPI", response.data);
      return response.data;
    } catch (error) {
      commit("SET_ERROR", error);
      console.error("Error creating KPI:", error.response || error);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  async updateKpi({ commit }, { id, kpiData }) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.patch(`/kpis/${id}`, kpiData);

      commit("UPDATE_KPI", response.data);
      return response.data;
    } catch (error) {
      commit("SET_ERROR", error);
      console.error("Error updating KPI:", error.response || error);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  async deleteKpi({ commit }, id) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      await apiClient.delete(`/kpis/${id}`);
      commit("REMOVE_KPI", id);
      notification.success({ message: "KPI deleted successfully!" });
      return true;
    } catch (error) {
      commit("SET_ERROR", error);
      console.error("Error deleting KPI:", error.response || error);
      notification.error({
        message: "Failed to delete KPI.",
        description: error.response?.data?.message || error.message,
      });
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  async fetchKpiUserAssignments({ commit }, kpiId) {
    console.log("ACTION fetchKpiUserAssignments called for KPI ID:", kpiId);

    try {
      console.log(
        `ACTION fetchKpiUserAssignments: Calling API GET /kpis/${kpiId}/assignments`
      );
      const response = await apiClient.get(`/kpis/${kpiId}/assignments`);
      console.log(
        "ACTION fetchKpiUserAssignments: API response received:",
        response
      );

      let assignments = [];
      if (response.data) {
        console.log("ACTION fetchKpiUserAssignments: Examining response.data");
        console.log(
          "ACTION fetchKpiUserAssignments: Is response.data an array?",
          Array.isArray(response.data)
        );
        console.log(
          "ACTION fetchKpiUserAssignments: Is response.data.data an array?",
          Array.isArray(response.data.data)
        );

        if (Array.isArray(response.data.data)) {
          console.log(
            "ACTION fetchKpiUserAssignments: Extracting from response.data.data"
          );
          assignments = response.data.data;
        } else if (Array.isArray(response.data)) {
          console.log(
            "ACTION fetchKpiUserAssignments: Extracting from response.data directly"
          );
          assignments = response.data;
        } else {
          console.warn(
            "ACTION fetchKpiUserAssignments: Unexpected response data structure.",
            response.data
          );
        }
      } else {
        console.warn(
          "ACTION fetchKpiUserAssignments: response.data is null or undefined."
        );
      }

      console.log(
        "ACTION fetchKpiUserAssignments: Extracted assignments data:",
        assignments
      );

      commit("SET_KPI_USER_ASSIGNMENTS", assignments);
      console.log(
        "ACTION fetchKpiUserAssignments: SET_KPI_USER_ASSIGNMENTS mutation committed."
      );

      return assignments;
    } catch (error) {
      console.error("ACTION fetchKpiUserAssignments: Error:", error);
      commit("SET_USER_ASSIGNMENT_ERROR", error);
      commit("SET_KPI_USER_ASSIGNMENTS", []);
      throw error;
    } finally {
      commit("SET_USER_ASSIGNMENT_LOADING", false);
    }
  },

  async saveDepartmentSectionAssignment(
    { commit, dispatch },
    { kpiId, assignmentsArray }
  ) {
    commit("SET_SUBMITTING_DEPARTMENT_SECTION_ASSIGNMENT", true);
    commit("SET_DEPARTMENT_SECTION_ASSIGNMENT_SAVE_ERROR", null);

    try {
      console.log(
        "saveDepartmentSectionAssignment action: Payload being sent (structured):",
        { assignments: assignmentsArray }
      );
      const response = await apiClient.post(
        `/kpis/${kpiId}/sections/assignments`,
        { assignments: assignmentsArray }
      );
      notification.success({ message: "Assignment saved successfully!" });

      await dispatch("fetchKpiUserAssignments", kpiId);

      return response.data;
    } catch (error) {
      commit("SET_DEPARTMENT_SECTION_ASSIGNMENT_SAVE_ERROR", error);
      console.error("Error saving assignment:", error.response || error);
      notification.error({
        message: "Failed to save assignment.",
        description: error.response?.data?.message || error.message,
      });
      throw error;
    } finally {
      commit("SET_SUBMITTING_DEPARTMENT_SECTION_ASSIGNMENT", false);
    }
  },

  async saveUserAssignments(
    { commit, dispatch },
    { kpiId, assignmentsPayload }
  ) {
    commit("SET_SUBMITTING_USER_DELETION", true);
    commit("SET_USER_DELETION_ERROR", null);

    try {
      const response = await apiClient.post(
        `/kpis/${kpiId}/assignments`,
        assignmentsPayload
      );
      notification.success({ message: "User Assignment saved successfully!" });

      console.log(
        "ACTION saveUserAssignments: Backend save response received:",
        response
      );

      await dispatch("fetchKpiUserAssignments", kpiId);

      return response.data;
    } catch (error) {
      commit("SET_USER_DELETION_ERROR", error);
      console.error("Error saving user assignment:", error.response || error);
      notification.error({
        message: "Failed to save user assignment.",
        description: error.response?.data?.message || error.message,
      });
      throw error;
    } finally {
      commit("SET_SUBMITTING_USER_DELETION", false);
    }
  },

  async deleteDepartmentSectionAssignment(
    { commit, dispatch },
    { assignmentId, kpiId }
  ) {
    commit("SET_SUBMITTING_DEPARTMENT_SECTION_DELETION", true);
    commit("SET_DEPARTMENT_SECTION_DELETION_ERROR", null);

    try {
      await apiClient.delete(`/kpi-assignments/${assignmentId}`);

      notification.success({ message: "Assignment deleted successfully!" });

      await dispatch("fetchKpiUserAssignments", kpiId);

      return true;
    } catch (error) {
      commit("SET_DEPARTMENT_SECTION_DELETION_ERROR", error);
      console.error(
        "Error deleting department/section assignment:",
        error.response || error
      );
      notification.error({
        message: "Failed to delete assignment.",
        description: error.response?.data?.message || error.message,
      });
      throw error;
    } finally {
      commit("SET_SUBMITTING_DEPARTMENT_SECTION_DELETION", false);
    }
  },

  async deleteUserAssignment({ commit, dispatch }, { kpiId, assignmentId }) {
    commit("SET_SUBMITTING_USER_DELETION", true);
    commit("SET_USER_DELETION_ERROR", null);

    try {
      await apiClient.delete(`/kpi-assignments/${assignmentId}`);

      notification.success({
        message: "User Assignment deleted successfully!",
      });

      await dispatch("fetchKpiUserAssignments", kpiId);

      return true;
    } catch (error) {
      commit("SET_USER_DELETION_ERROR", error);
      console.error("Error deleting user assignment:", error.response || error);
      notification.error({
        message: "Failed to delete user assignment.",
        description: error.response?.data?.message || error.message,
      });
      throw error;
    } finally {
      commit("SET_SUBMITTING_USER_DELETION", false);
    }
  },

  async fetchMyAssignments({ commit }, userId) {
    if (!userId) {
      console.warn("fetchMyAssignments: userId is required.");
      commit("SET_MY_ASSIGNMENTS", []);
      return [];
    }
    commit("SET_MY_ASSIGNMENTS_LOADING", true);
    commit("SET_MY_ASSIGNMENTS_ERROR", null);

    try {
      const response = await apiClient.get(`/kpis/employees/${userId}`);

      const assignments = response.data?.data || response.data || [];
      commit("SET_MY_ASSIGNMENTS", assignments);
      return assignments;
    } catch (error) {
      commit("SET_MY_ASSIGNMENTS_ERROR", error);
      commit("SET_MY_ASSIGNMENTS", []);
      console.error("Error fetching my assignments:", error.response || error);
      throw error;
    } finally {
      commit("SET_MY_ASSIGNMENTS_LOADING", false);
    }
  },

  async submitKpiUpdate({ commit }, { assignmentId, updateData }) {
    commit("SET_SUBMIT_UPDATE_LOADING", true);
    commit("SET_SUBMIT_UPDATE_ERROR", null);

    try {
      const response = await apiClient.post(
        `/kpi-assignments/${assignmentId}/updates`,
        updateData
      );
      notification.success({
        message: "Progress update submitted successfully!",
      });

      return response.data;
    } catch (error) {
      commit("SET_SUBMIT_UPDATE_ERROR", error);
      console.error("Error submitting KPI update:", error.response || error);
      notification.error({
        message: "Failed to submit progress update.",
        description: error.response?.data?.message || error.message,
      });
      throw error;
    } finally {
      commit("SET_SUBMIT_UPDATE_LOADING", false);
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
