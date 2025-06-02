import apiClient from "@/core/services/api";
import { KpiDefinitionStatus } from "@/core/constants/kpiStatus";
import store from "@/core/store";

const state = {
  kpis: [],
  kpisAllForSelect: [],
  sectionKpiList: [],
  departmentKpiList: [],
  currentKpi: null,

  currentKpiUserAssignments: [],
  userAssignmentError: null,

  myAssignments: [],
  myAssignmentsError: null,

  submitUpdateError: null,
  departmentSectionAssignmentSaveError: null,
  departmentSectionDeletionError: null,
  userDeletionError: null,
  saveUserAssignmentError: null,

  error: null,

  pagination: {
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    itemsPerPage: 10,
  },

  employeeKpiList: [],
  employeeKpiError: null,
};

const getters = {
  kpiList: (state) => state.kpis,
  kpiListAll: (state) => state.kpisAllForSelect,
  sectionKpiList: (state) => state.sectionKpiList,
  departmentKpiList: (state) => state.departmentKpiList,
  currentKpi: (state) => state.currentKpi,

  currentKpiUserAssignments: (state) => state.currentKpiUserAssignments,
  userAssignmentError: (state) => state.userAssignmentError,

  myAssignments: (state) => state.myAssignments,
  myAssignmentsError: (state) => state.myAssignmentsError,

  submitUpdateError: (state) => state.submitUpdateError,
  departmentSectionAssignmentSaveError: (state) =>
    state.departmentSectionAssignmentSaveError,
  departmentSectionDeletionError: (state) =>
    state.departmentSectionDeletionError,
  userDeletionError: (state) => state.userDeletionError,
  saveUserAssignmentError: (state) => state.saveUserAssignmentError,

  error: (state) => state.error,
  pagination: (state) => state.pagination,

  employeeKpiList: (state) => state.employeeKpiList,
  employeeKpiError: (state) => state.employeeKpiError,
};

const mutations = {
  SET_ERROR(state, error) {
    state.error = error
      ? error.response?.data?.message ||
        error.message ||
        "An unknown error occurred"
      : null;
  },

  SET_USER_ASSIGNMENT_ERROR(state, error) {
    state.userAssignmentError = error
      ? error.response?.data?.message ||
        error.message ||
        "An assignment fetch error occurred"
      : null;
  },
  SET_KPI_USER_ASSIGNMENTS(state, assignments) {
    state.currentKpiUserAssignments = [...(assignments || [])];
  },

  SET_MY_ASSIGNMENTS_ERROR(state, error) {
    state.myAssignmentsError = error
      ? error.response?.data?.message || error.message
      : null;
  },
  SET_MY_ASSIGNMENTS(state, assignments) {
    state.myAssignments = assignments || [];
  },

  SET_SUBMIT_UPDATE_ERROR(state, error) {
    state.submitUpdateError = error
      ? error.response?.data?.message || error.message
      : null;
  },

  SET_DEPARTMENT_SECTION_ASSIGNMENT_SAVE_ERROR(state, error) {
    state.departmentSectionAssignmentSaveError = error
      ? error.response?.data?.message ||
        error.message ||
        "An error occurred while saving assignment."
      : null;
  },

  SET_DEPARTMENT_SECTION_DELETION_ERROR(state, error) {
    state.departmentSectionDeletionError = error
      ? error.response?.data?.message ||
        error.message ||
        "An unknown deletion error occurred"
      : null;
  },

  SET_USER_DELETION_ERROR(state, error) {
    state.userDeletionError = error
      ? error.response?.data?.message ||
        error.message ||
        "An error occurred while deleting user assignment."
      : null;
  },

  SET_SAVE_USER_ASSIGNMENT_ERROR(state, error) {
    state.saveUserAssignmentError = error
      ? error.response?.data?.message ||
        error.message ||
        "Failed to save user assignment."
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

    // Cập nhật trong danh sách chính
    const index = state.kpis.findIndex((k) => k.id === updatedKpi.id);
    if (index !== -1) {
      state.kpis.splice(index, 1, { ...state.kpis[index], ...updatedKpi });
    }

    // Cập nhật trong danh sách select
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

    // Cập nhật chi tiết nếu đang xem
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
};

const actions = {
  async fetchKpis({ commit }, params = {}) {
    await store.dispatch("loading/startLoading");
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
      await store.dispatch("loading/stopLoading");
    }
  },

  async fetchSectionKpis({ commit }, filterParams) {
    await store.dispatch("loading/startLoading");
    commit("SET_ERROR", null);
    commit("SET_SECTION_KPIS", null);
    try {
      const sectionIdInPath = filterParams.sectionIdForApi;
      const queryParams = { ...filterParams };
      delete queryParams.sectionIdForApi;

      if (queryParams.departmentIdForQuery) {
        queryParams.departmentId = queryParams.departmentIdForQuery;
        delete queryParams.departmentIdForQuery;
      }

      const url = `/kpis/sections/${sectionIdInPath}`;
      const response = await apiClient.get(url, { params: queryParams });
      commit("SET_SECTION_KPIS", response.data);
      return response.data;
    } catch (error) {
      commit("SET_ERROR", error);
      commit("SET_SECTION_KPIS", null);
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  async fetchDepartmentKpis(
    { commit },
    { departmentId = null, filters = {} } = {}
  ) {
    await store.dispatch("loading/startLoading");
    commit("SET_ERROR", null);
    commit("SET_DEPARTMENT_KPI_LIST", null);
    try {
      let url = "/kpis/departments";
      if (departmentId) {
        url += `/${departmentId}`;
      }
      const response = await apiClient.get(url, { params: filters });
      commit("SET_DEPARTMENT_KPI_LIST", response.data);
      return response.data;
    } catch (error) {
      commit("SET_ERROR", error);
      commit("SET_DEPARTMENT_KPI_LIST", null);
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  async fetchAllKpisForSelect({ commit, state }, forceRefresh = false) {
    if (state.kpisAllForSelect.length > 0 && !forceRefresh)
      return state.kpisAllForSelect;
    await store.dispatch("loading/startLoading");
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
      await store.dispatch("loading/stopLoading");
    }
  },

  async fetchKpiDetail({ commit }, id) {
    await store.dispatch("loading/startLoading");
    commit("SET_ERROR", null);
    commit("SET_CURRENT_KPI", null);
    try {
      const response = await apiClient.get(`/kpis/${id}`);
      const kpi = response.data;
      if (!kpi) {
        throw new Error("Invalid KPI detail response format");
      }
      commit("SET_CURRENT_KPI", kpi);
      return kpi;
    } catch (error) {
      commit("SET_ERROR", error);
      commit("SET_CURRENT_KPI", null);
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  async createKpi({ commit }, kpiData) {
    await store.dispatch("loading/startLoading");
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.post("/kpis/createKpi", kpiData);
      commit("ADD_KPI", response.data);
      return response.data;
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  async updateKpi({ commit }, { id, kpiData }) {
    await store.dispatch("loading/startLoading");
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.patch(`/kpis/${id}`, kpiData);
      commit("UPDATE_KPI", response.data);
      return response.data;
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  async deleteKpi({ commit }, id) {
    await store.dispatch("loading/startLoading");
    commit("SET_ERROR", null);
    try {
      await apiClient.delete(`/kpis/${id}`);
      commit("REMOVE_KPI", id);
      return true;
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  async fetchKpiUserAssignments({ commit }, kpiId) {
    await store.dispatch("loading/startLoading");
    commit("SET_USER_ASSIGNMENT_ERROR", null);
    try {
      const response = await apiClient.get(`/kpis/${kpiId}/assignments`);
      commit("SET_KPI_USER_ASSIGNMENTS", response.data?.data || []);
      return response.data?.data || [];
    } catch (error) {
      commit("SET_USER_ASSIGNMENT_ERROR", error);
      commit("SET_KPI_USER_ASSIGNMENTS", []);
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  async saveUserAssignments(
    { commit, dispatch },
    { kpiId, assignmentsPayload }
  ) {
    await store.dispatch("loading/startLoading");
    commit("SET_SAVE_USER_ASSIGNMENT_ERROR", null);
    try {
      const response = await apiClient.post(
        `/kpis/${kpiId}/assignments`,
        assignmentsPayload
      );
      await dispatch("fetchKpiDetail", kpiId);
      return response.data;
    } catch (error) {
      commit("SET_SAVE_USER_ASSIGNMENT_ERROR", error);
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  async fetchMyAssignments({ commit }, userId) {
    await store.dispatch("loading/startLoading");
    commit("SET_MY_ASSIGNMENTS_ERROR", null);
    try {
      const response = await apiClient.get(`/kpis/employees/${userId}`);
      commit("SET_MY_ASSIGNMENTS", response.data?.data || []);
      return response.data?.data || [];
    } catch (error) {
      commit("SET_MY_ASSIGNMENTS_ERROR", error);
      commit("SET_MY_ASSIGNMENTS", []);
      throw error;
    } finally {
      await store.dispatch("loading/stopLoading");
    }
  },

  async submitKpiUpdate({ commit }, { assignmentId, updateData }) {
    await store.dispatch("loading/startLoading");
    commit("SET_SUBMIT_UPDATE_ERROR", null);
    try {
      const response = await apiClient.post(
        `/kpi-assignments/${assignmentId}/updates`,
        updateData
      );
      return response.data;
    } catch (error) {
      commit("SET_SUBMIT_UPDATE_ERROR", error);
      throw error;
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
