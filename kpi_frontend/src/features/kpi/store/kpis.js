import apiClient from "@/core/services/api";
import { notification } from "ant-design-vue";
import { getTranslatedErrorMessage } from "@/core/services/messageTranslator";
import i18n from "@/core/i18n";
import { KpiDefinitionStatus } from "@/core/constants/kpiStatus";

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

  isSavingUserAssignment: false,
  saveUserAssignmentError: null,

  loading: false,
  loadingAll: false,
  error: null,

  pagination: {
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    itemsPerPage: 10,
  },

  employeeKpiList: [],
  loadingEmployeeKpis: false,
  employeeKpiError: null,
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

  isSavingUserAssignment: (state) => state.isSavingUserAssignment,
  saveUserAssignmentError: (state) => state.saveUserAssignmentError,

  isLoading: (state) => state.loading,
  error: (state) => state.error,
  pagination: (state) => state.pagination,

  employeeKpiList: (state) => state.employeeKpiList,
  isLoadingEmployeeKpis: (state) => state.loadingEmployeeKpis,
  employeeKpiError: (state) => state.employeeKpiError,
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
      ? getTranslatedErrorMessage(error.response?.data?.message) ||
        error.message ||
        i18n.global.t("errors.unknownError")
      : null;
  },

  SET_USER_ASSIGNMENT_LOADING(state, isLoading) {
    state.loadingUserAssignments = isLoading;
  },
  SET_USER_ASSIGNMENT_ERROR(state, error) {
    state.userAssignmentError = error
      ? getTranslatedErrorMessage(error.response?.data?.message) ||
        error.message ||
        i18n.global.t("errors.unknownError")
      : null;
  },
  SET_KPI_USER_ASSIGNMENTS(state, assignments) {
    state.currentKpiUserAssignments = [...(assignments || [])];
  },

  SET_MY_ASSIGNMENTS_LOADING(state, isLoading) {
    state.loadingMyAssignments = isLoading;
  },
  SET_MY_ASSIGNMENTS_ERROR(state, error) {
    state.myAssignmentsError = error
      ? getTranslatedErrorMessage(error.response?.data?.message) ||
        error.message
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
      ? getTranslatedErrorMessage(error.response?.data?.message) ||
        error.message
      : null;
  },

  SET_SUBMITTING_DEPARTMENT_SECTION_ASSIGNMENT(state, isLoading) {
    state.submittingDepartmentSectionAssignment = isLoading;
  },
  SET_DEPARTMENT_SECTION_ASSIGNMENT_SAVE_ERROR(state, error) {
    state.departmentSectionAssignmentSaveError = error
      ? getTranslatedErrorMessage(error.response?.data?.message) ||
        error.message ||
        i18n.global.t("errors.unknownError")
      : null;
  },

  SET_SUBMITTING_DEPARTMENT_SECTION_DELETION(state, isLoading) {
    state.submittingDepartmentSectionDeletion = isLoading;
  },
  SET_DEPARTMENT_SECTION_DELETION_ERROR(state, error) {
    state.departmentSectionDeletionError = error
      ? getTranslatedErrorMessage(error.response?.data?.message) ||
        error.message ||
        i18n.global.t("errors.unknownError")
      : null;
  },

  SET_SUBMITTING_USER_DELETION(state, isLoading) {
    state.submittingUserDeletion = isLoading;
  },
  SET_USER_DELETION_ERROR(state, error) {
    state.userDeletionError = error
      ? getTranslatedErrorMessage(error.response?.data?.message) ||
        error.message ||
        i18n.global.t("errors.unknownError")
      : null;
  },

  SET_SAVING_USER_ASSIGNMENT_LOADING(state, isLoading) {
    state.isSavingUserAssignment = isLoading;
  },
  SET_SAVE_USER_ASSIGNMENT_ERROR(state, error) {
    state.saveUserAssignmentError = error
      ? getTranslatedErrorMessage(error.response?.data?.message) ||
        error.message ||
        i18n.global.t("errors.unknownError")
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
    if (index !== -1) {
      state.kpis.splice(index, 1, { ...state.kpis[index], ...updatedKpi });
    }

    const indexAll = state.kpisAllForSelect.findIndex(
      (k) => k.id === updatedKpi.id
    );
    if (indexAll !== -1) {
      state.kpisAllForSelect.splice(indexAll, 1, {
        id: updatedKpi.id,
        name: updatedKpi.name,
        path: updatedKpi.path,
      });
    }

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
  SET_TOGGLING_KPI_STATUS(state, isLoading) {
    state.isTogglingKpiStatus = isLoading;
  },
  SET_TOGGLE_KPI_STATUS_ERROR(state, error) {
    state.toggleKpiStatusError = error;
  },

  UPDATE_SINGLE_KPI_STATUS(state, { kpiId, newStatus }) {
    const newAssignmentStatus =
      newStatus === KpiDefinitionStatus.APPROVED ? "APPROVED" : "DRAFT";

    if (state.currentKpi && state.currentKpi.id === kpiId) {
      state.currentKpi = {
        ...state.currentKpi,
        status: newStatus,
        assignments:
          state.currentKpi.assignments?.map((a) => ({
            ...a,
            status: newAssignmentStatus,
          })) || [],
      };
    }

    const kpiIndex = state.kpis.findIndex((kpi) => kpi.id === kpiId);
    if (kpiIndex !== -1) {
      const oldKpi = state.kpis[kpiIndex];
      state.kpis.splice(kpiIndex, 1, {
        ...oldKpi,
        status: newStatus,
        assignments:
          oldKpi.assignments?.map((a) => ({
            ...a,
            status: newAssignmentStatus,
          })) || [],
      });
    }
  },
  SET_EMPLOYEE_KPI_LIST(state, kpis) {
    if (kpis && typeof kpis === "object" && kpis.data) {
      state.employeeKpiList = kpis;
    } else {
      state.employeeKpiList = { data: Array.isArray(kpis) ? kpis : [] };
    }
  },
  SET_LOADING_EMPLOYEE_KPIS(state, isLoading) {
    state.loadingEmployeeKpis = isLoading;
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
      const sectionIdInPath = filterParams.sectionIdForApi;
      const queryParams = { ...filterParams };
      delete queryParams.sectionIdForApi;
      if (
        queryParams.departmentIdForQuery !== undefined &&
        queryParams.departmentIdForQuery !== null
      ) {
        queryParams.departmentId = queryParams.departmentIdForQuery;
        delete queryParams.departmentIdForQuery;
      }
      const url = `/kpis/sections/${sectionIdInPath}`;

      // Add limit to get all KPIs since we don't have pagination UI
      queryParams.limit = 1000;

      const response = await apiClient.get(url, {
        params: queryParams,
      });
      commit("SET_SECTION_KPIS", response.data);

      return response.data;
    } catch (error) {
      console.error(
        "ACTION fetchSectionKpis: Error fetching section KPIs:",
        error.response || error
      );
      commit("SET_ERROR", error);
      commit("SET_SECTION_KPIS", null);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  async fetchDepartmentKpis(
    { commit },
    { departmentId = null, filters = {} } = {}
  ) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    commit("SET_DEPARTMENT_KPI_LIST", null);
    try {
      const deptId = departmentId || 0;
      const url = `/kpis/departments/${deptId}`;

      const { ...queryFilters } = filters;
      // Add limit to get all KPIs since we don't have pagination UI
      queryFilters.limit = 1000;
      const response = await apiClient.get(url, { params: queryFilters });
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
        params: { limit: 1000 },
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
      const response = await apiClient.get(`/kpis/${id}`);

      const kpi = response.data;
      if (!kpi) {
        console.error(
          "ACTION fetchKpiDetail: response.data is null or undefined",
          response
        );
        throw new Error("Invalid KPI detail response format");
      }

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
      const createdKpi = response.data;

      commit("ADD_KPI", createdKpi);
      if (createdKpi && createdKpi.status === KpiDefinitionStatus.DRAFT) {
        notification.success({
          message: "KPI Created Successfully!",
          description:
            "KPI has been created successfully. Please wait or contact your manager for approval, then you can submit value.",
        });
      } else if (createdKpi) {
        notification.success({ message: "KPI Created Successfully!" });
      }
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

      let errorMessage = i18n.global.t("errors.unknownError");
      let errorDescription =
        getTranslatedErrorMessage(error.response?.data?.message) ||
        error.message;

      if (error.response?.status === 403) {
        errorMessage = i18n.global.t("errors.accessDenied");
        errorDescription =
          getTranslatedErrorMessage(error.response?.data?.message) ||
          i18n.global.t("errors.noPermission", {
            action: i18n.global.t("common.delete"),
            resource: i18n.global.t("resources.kpi"),
          });
      }
      notification.error({
        message: errorMessage,
        description: errorDescription,
      });
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  async fetchKpiUserAssignments({ commit }, kpiId) {
    try {
      const response = await apiClient.get(`/kpis/${kpiId}/assignments`);

      let assignments = [];
      if (response.data) {
        if (Array.isArray(response.data.data)) {
          assignments = response.data.data;
        } else if (Array.isArray(response.data)) {
          assignments = response.data;
        }
      }

      commit("SET_KPI_USER_ASSIGNMENTS", assignments);

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
      const response = await apiClient.post(
        `/kpis/${kpiId}/sections/assignments`,
        { assignments: assignmentsArray }
      );
      notification.success({ message: "Assignment saved successfully!" });
      await dispatch("fetchKpiDetail", kpiId);
      return response.data;
    } catch (error) {
      const errorMsg =
        getTranslatedErrorMessage(error.response?.data?.message) ||
        error.message ||
        i18n.global.t("errors.unknownError");
      commit("SET_DEPARTMENT_SECTION_ASSIGNMENT_SAVE_ERROR", errorMsg);
      notification.error({ message: "Save Failed", description: errorMsg });
      throw error;
    } finally {
      commit("SET_SUBMITTING_DEPARTMENT_SECTION_ASSIGNMENT", false);
    }
  },

  async saveUserAssignments(
    { commit, dispatch },
    { kpiId, assignmentsPayload }
  ) {
    commit("SET_SAVING_USER_ASSIGNMENT_LOADING", true);
    commit("SET_SAVE_USER_ASSIGNMENT_ERROR", null);
    try {
      const response = await apiClient.post(
        `/kpis/${kpiId}/assignments`,
        assignmentsPayload
      );
      await dispatch("fetchKpiDetail", kpiId);
      return response.data;
    } catch (error) {
      const errorMsg =
        getTranslatedErrorMessage(error.response?.data?.message) ||
        error.message ||
        i18n.global.t("errors.unknownError");
      commit("SET_SAVE_USER_ASSIGNMENT_ERROR", errorMsg);
      notification.error({ message: "Save Failed", description: errorMsg });
      throw error;
    } finally {
      commit("SET_SAVING_USER_ASSIGNMENT_LOADING", false);
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
        message: i18n.global.t("errors.unknownError"),
        description:
          getTranslatedErrorMessage(error.response?.data?.message) ||
          error.message,
      });
      throw error;
    } finally {
      commit("SET_SUBMITTING_DEPARTMENT_SECTION_DELETION", false);
    }
  },

  async deleteUserAssignment({ commit, dispatch }, { kpiId, assignmentId }) {
    commit("SET_SUBMITTING_USER_DELETION", true);
    commit("SET_USER_DELETION_ERROR", null);

    if (!kpiId || !assignmentId) {
      console.error("deleteUserAssignment: Missing kpiId or assignmentId");
      commit("SET_USER_DELETION_ERROR", "Missing required ID for deletion.");
      commit("SET_SUBMITTING_USER_DELETION", false);
      throw new Error("Missing required ID for deletion.");
    }

    try {
      await apiClient.delete(`/kpi-assignments/${assignmentId}`);

      try {
        await dispatch("fetchKpiDetail", kpiId);
      } catch (fetchError) {
        console.error(
          `[deleteUserAssignment] Error refetching KPI Detail ${kpiId} after delete:`,
          fetchError
        );
      }

      return true;
    } catch (error) {
      const errorMsg =
        getTranslatedErrorMessage(error.response?.data?.message) ||
        error.message ||
        i18n.global.t("errors.unknownError");
      commit("SET_USER_DELETION_ERROR", errorMsg);
      console.error("Error deleting user assignment:", error.response || error);
      notification.error({ message: "Deletion Failed", description: errorMsg });
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

      return response.data;
    } catch (error) {
      commit("SET_SUBMIT_UPDATE_ERROR", error);
      console.error("Error submitting KPI update:", error.response || error);
      notification.error({
        message: i18n.global.t("errors.unknownError"),
        description:
          getTranslatedErrorMessage(error.response?.data?.message) ||
          error.message,
      });
      throw error;
    } finally {
      commit("SET_SUBMIT_UPDATE_LOADING", false);
    }
  },

  async toggleKpiStatus({ commit }, { kpiId }) {
    commit("SET_TOGGLING_KPI_STATUS", true);
    commit("SET_TOGGLE_KPI_STATUS_ERROR", null);
    try {
      const response = await apiClient.patch(`/kpis/${kpiId}/toggle-status`);
      const updatedKpi = response.data;

      if (updatedKpi && updatedKpi.status) {
        commit("UPDATE_SINGLE_KPI_STATUS", {
          kpiId: kpiId,
          newStatus: updatedKpi.status,
        });
        return updatedKpi;
      } else {
        throw new Error("Invalid response received after toggling status.");
      }
    } catch (error) {
      const errorMsg =
        getTranslatedErrorMessage(error.response?.data?.message) ||
        error.message ||
        i18n.global.t("errors.unknownError");
      commit("SET_TOGGLE_KPI_STATUS_ERROR", errorMsg);

      // Only show notification if it's not a permission error (already handled by API interceptor)
      if (!errorMsg.includes("No permission")) {
        notification.error({ message: "Update Failed", description: errorMsg });
      }

      throw error;
    } finally {
      commit("SET_TOGGLING_KPI_STATUS", false);
    }
  },

  async fetchKpisByEmployee({ commit }, { employeeId, filters = {} }) {
    commit("SET_LOADING_EMPLOYEE_KPIS", true);
    commit("SET_EMPLOYEE_KPI_ERROR", null);
    try {
      const response = await apiClient.get(`/kpis/employees/${employeeId}`, {
        params: filters,
      });
      const kpis = response.data?.data || response.data || [];
      commit("SET_EMPLOYEE_KPI_LIST", kpis);
      return kpis;
    } catch (error) {
      commit("SET_EMPLOYEE_KPI_ERROR", error);
      commit("SET_EMPLOYEE_KPI_LIST", []);
      throw error;
    } finally {
      commit("SET_LOADING_EMPLOYEE_KPIS", false);
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
