// store/modules/kpis.js - Đã refactor, tích hợp API User Assignment, My Assignment, Submit Update

import apiClient from "../../services/api";
// import router from "../../router"; // Import nếu cần

const state = {
  kpis: [], // Danh sách KPI chung (có phân trang)
  kpisAllForSelect: [], // Danh sách KPI rút gọn cho select box
  sectionKpiList: [],
  departmentKpiList: [],
  currentKpi: null, // KPI đang xem chi tiết
  // === State cho User Assignments của currentKpi ===
  currentKpiUserAssignments: [], // Danh sách user assignments của KPI đang xem
  loadingUserAssignments: false, // Loading riêng cho user assignment của currentKpi
  userAssignmentError: null, // Lỗi riêng cho user assignment của currentKpi
  // === State cho My Assignments (KPI cá nhân) ===
  myAssignments: [],
  loadingMyAssignments: false,
  myAssignmentsError: null,
  // === State cho Submit Progress Update ===
  submittingUpdate: false,
  submitUpdateError: null,
  // === State chung ===
  loading: false, // Loading chính (fetch list, detail KPI)
  loadingAll: false, // Loading cho fetchAllKpisForSelect
  error: null, // Lỗi chung
  pagination: {
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    itemsPerPage: 10,
  },
  // === State cho Approval (Placeholder - Nên đưa ra module riêng) ===
  // pendingApprovals: [],
  // loadingApprovals: false,
  // approvalError: null,
};

const getters = {
  kpiList: (state) => state.kpis,
  kpiListAll: (state) => state.kpisAllForSelect,
  sectionKpiList: (state) => state.sectionKpiList,
  departmentKpiList: (state) => state.departmentKpiList,
  currentKpi: (state) => state.currentKpi,
  // Getters cho User Assignment của currentKpi
  currentKpiUserAssignments: (state) => state.kpiUserAssignments,
  isLoadingUserAssignments: (state) => state.loadingUserAssignments,
  userAssignmentError: (state) => state.userAssignmentError,
  // Getters cho My Assignments
  myAssignments: (state) => state.myAssignments,
  isLoadingMyAssignments: (state) => state.loadingMyAssignments,
  myAssignmentsError: (state) => state.myAssignmentsError,
  // Getters cho Submit Progress Update
  isSubmittingUpdate: (state) => state.submittingUpdate,
  submitUpdateError: (state) => state.submitUpdateError,
  // Getters chung
  isLoading: (state) => state.loading,
  error: (state) => state.error,
  pagination: (state) => state.pagination,
  // Getter cho Approval (Placeholder)
  // pendingApprovals: (state) => state.pendingApprovals,
};

const mutations = {
  // Mutations chung
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
  // Mutations cho User Assignment
  SET_USER_ASSIGNMENT_LOADING(state, isLoading) {
    state.loadingUserAssignments = isLoading;
  },
  SET_USER_ASSIGNMENT_ERROR(state, error) {
    state.userAssignmentError = error
      ? error.response?.data?.message ||
        error.message ||
        "An assignment error occurred"
      : null;
  },
  SET_KPI_USER_ASSIGNMENTS(state, assignments) {
    state.kpiUserAssignments = assignments || [];
  },
  // Mutations cho My Assignments
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
  // Mutations cho Submit Progress Update
  SET_SUBMIT_UPDATE_LOADING(state, isLoading) {
    state.submittingUpdate = isLoading;
  },
  SET_SUBMIT_UPDATE_ERROR(state, error) {
    state.submitUpdateError = error
      ? error.response?.data?.message || error.message
      : null;
  },
  // Mutations cho KPI CRUD
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
    state.kpisAllForSelect = kpis || [];
  },
  SET_CURRENT_KPI(state, kpi) {
    state.currentKpi = kpi;
    // Reset user assignments khi đổi KPI
    state.kpiUserAssignments = [];
    // Bỏ reset section assignments
    // state.currentKpiSectionAssignments = [];
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
  // Mutations cho Approval (Placeholder)
  // SET_PENDING_APPROVALS(state, approvals) { ... },
  // SET_APPROVAL_LOADING(state, isLoading) { ... },
  // SET_APPROVAL_ERROR(state, error) { ... },
};

const actions = {
  // --- KPI CRUD Actions ---
  async fetchKpis({ commit }, params = {}) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.get("/kpis", { params });
      commit("SET_KPIS", response);
    } catch (error) {
      commit("SET_ERROR", error);
      commit("SET_KPIS", null);
    } finally {
      commit("SET_LOADING", false);
    }
  },
  async fetchSectionKpis({ commit }, id) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    commit("SET_SECTION_KPIS", null);
    try {
      const response = await apiClient.get(`/kpis/sections/${id}`);
      commit("SET_SECTION_KPIS", response.data);
    } catch (error) {
      commit("SET_ERROR", error);
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
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },
  async fetchKpiScope({ commit }, { scope }) {
    const res = await apiClient.get(`/kpis?scope=${scope}`);
    commit("setKpiList", res);
  },
  // Action riêng để lấy danh sách rút gọn cho dropdown Parent KPI
  async fetchAllKpisForSelect({ commit, state }, forceRefresh = false) {
    if (state.kpisAllForSelect.length > 0 && !forceRefresh) return;
    commit("SET_LOADING_ALL", true);
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.get("/kpis", {
        params: { limit: 1000, fields: "id,name,path" },
      });
      commit("SET_KPIS_ALL_FOR_SELECT", response.data?.data || response.data);
    } catch (error) {
      commit("SET_ERROR", error);
    } finally {
      commit("SET_LOADING_ALL", false);
    }
  },
  async fetchKpiDetail({ commit }, id) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    commit("SET_CURRENT_KPI", null);
    try {
      const response = await apiClient.get(`/kpis/${id}`);
      commit("SET_CURRENT_KPI", response.data);
    } catch (error) {
      // API cần trả về đủ relations
      commit("SET_ERROR", error);
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
      // Endpoint /kpis là đúng theo convention
      commit("SET_ERROR", error);
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
      return true;
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  // === ACTIONS QUẢN LÝ USER ASSIGNMENT (Đã gắn API thật) ===
  async fetchKpiUserAssignments({ commit }, kpiId) {
    // Bỏ context nếu API GET không cần filter
    if (!kpiId) {
      commit("SET_KPI_USER_ASSIGNMENTS", []);
      return [];
    }
    commit("SET_USER_ASSIGNMENT_LOADING", true);
    commit("SET_USER_ASSIGNMENT_ERROR", null);
    commit("SET_KPI_USER_ASSIGNMENTS", []); // Reset trước khi fetch
    try {
      // API: GET /kpis/:id/assignments
      const response = await apiClient.get(`/kpis/${kpiId}/assignments`); // <<< API THẬT
      const assignments = response.data?.data || response.data || []; // Xử lý cấu trúc data
      commit("SET_KPI_USER_ASSIGNMENTS", assignments);
      return assignments;
    } catch (error) {
      commit("SET_USER_ASSIGNMENT_ERROR", error);
      commit("SET_KPI_USER_ASSIGNMENTS", []);
      console.error(
        "Error fetching user assignments:",
        error.response || error
      );
      throw error;
    } finally {
      commit("SET_USER_ASSIGNMENT_LOADING", false);
    }
  },
  async saveUserAssignments(
    { commit, dispatch },
    { kpiId, assignmentsPayload }
  ) {
    // Bỏ context nếu API không cần
    commit("SET_USER_ASSIGNMENT_LOADING", true);
    commit("SET_USER_ASSIGNMENT_ERROR", null);
    try {
      // API: POST /kpis/:id/assignments
      // Payload: { assignments: [ { user_id, target, weight } ] }
      const response = await apiClient.post(
        `/kpis/${kpiId}/assignments`,
        assignmentsPayload
      ); // <<< API THẬT
      // Fetch lại danh sách assignments sau khi lưu
      await dispatch("fetchKpiUserAssignments", kpiId);
      return response.data;
    } catch (error) {
      commit("SET_USER_ASSIGNMENT_ERROR", error);
      throw error;
    } finally {
      commit("SET_USER_ASSIGNMENT_LOADING", false);
    }
  },
  async deleteUserAssignment({ commit, dispatch }, { kpiId, assignmentId }) {
    // Bỏ context
    commit("SET_USER_ASSIGNMENT_LOADING", true);
    commit("SET_USER_ASSIGNMENT_ERROR", null);
    try {
      // API: DELETE /kpi-assignments/:id
      await apiClient.delete(`/kpi-assignments/${assignmentId}`); // <<< API THẬT
      // Fetch lại danh sách assignments sau khi xóa
      await dispatch("fetchKpiUserAssignments", kpiId);
      return true;
    } catch (error) {
      commit("SET_USER_ASSIGNMENT_ERROR", error);
      throw error;
    } finally {
      commit("SET_USER_ASSIGNMENT_LOADING", false);
    }
  },
  // Action updateUserAssignment chưa cần thiết nếu API POST xử lý được cả update/create

  // === ACTION LẤY KPI CỦA CÁ NHÂN TÔI ===
  async fetchMyAssignments({ commit }, userId) {
    if (!userId) {
      commit("SET_MY_ASSIGNMENTS", []);
      return [];
    }
    commit("SET_MY_ASSIGNMENTS_LOADING", true);
    commit("SET_MY_ASSIGNMENTS_ERROR", null);
    commit("SET_MY_ASSIGNMENTS", []);
    try {
      // API: GET /kpi-assignments/?employeeid={userId}
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

  // === ACTION GỬI UPDATE TIẾN ĐỘ ===
  async submitKpiUpdate({ commit }, { assignmentId, updateData }) {
    commit("SET_SUBMIT_UPDATE_LOADING", true);
    commit("SET_SUBMIT_UPDATE_ERROR", null);
    try {
      // API: POST /kpi-assignments/{assignmentId}/updates
      // Body: { notes, project_details }
      const response = await apiClient.post(
        `/kpi-assignments/${assignmentId}/updates`,
        updateData
      ); // <<< API THẬT
      return response.data;
    } catch (error) {
      commit("SET_SUBMIT_UPDATE_ERROR", error);
      console.error("Error submitting KPI update:", error.response || error);
      throw error;
    } finally {
      commit("SET_SUBMIT_UPDATE_LOADING", false);
    }
  },

  // === ACTIONS CHO APPROVAL (Placeholder - Cần API và làm rõ) ===
  async fetchApprovalItemDetails({ commit }, assignmentId) {
    commit("SET_APPROVAL_LOADING", true);
    commit("SET_APPROVAL_ERROR", null);
    try {
      // API: GET /kpi-assignments/approve/confirm-and-submit/{assignmentId}
      console.warn(
        `API Call Needed: GET /kpi-assignments/approve/confirm-and-submit/${assignmentId} - Purpose unclear. Needs implementation.`
      );
      // const response = await apiClient.get(`/kpi-assignments/approve/confirm-and-submit/${assignmentId}`);
      // commit('SET_CURRENT_APPROVAL_ITEM', response.data);
      return {}; // Placeholder
    } catch (error) {
      /* commit(SET_APPROVAL_ERROR...) */ console.error(
        "Error fetching approval detail:",
        error
      );
      throw error;
    } finally {
      /* commit(SET_APPROVAL_LOADING...) */
    }
  },
  async approveUpdate(
    { commit, dispatch },
    { kpiValueId, kpiIdToReload, context }
  ) {
    commit("SET_APPROVAL_LOADING", true);
    commit("SET_APPROVAL_ERROR", null);
    try {
      // API: PATCH(?) /kpi-assignments/approve/{kpiValueId}
      console.warn(
        `API Call Needed: METHOD? PAYLOAD? /kpi-assignments/approve/${kpiValueId}`
      );
      // await apiClient.patch(`/kpi-assignments/approve/${kpiValueId}`, { status: 'Approved' }); // Ví dụ
      // Tạm thời fake thành công và fetch lại assignments
      await new Promise((r) => setTimeout(r, 300)); // Fake delay
      await dispatch("fetchKpiUserAssignments", {
        kpiId: kpiIdToReload,
        context,
      });
      return true;
    } catch (error) {
      /* ... */ console.error("Error approving update:", error);
      throw error;
    } finally {
      /* ... */
    }
  },
  async rejectUpdate(
    { commit, dispatch },
    { kpiValueId, kpiIdToReload, context }
  ) {
    commit("SET_APPROVAL_LOADING", true);
    commit("SET_APPROVAL_ERROR", null);
    try {
      // API: PATCH(?) /kpi-assignments/approve/{kpiValueId}
      console.warn(
        `API Call Needed: METHOD? PAYLOAD? /kpi-assignments/approve/${kpiValueId}`
      );
      // await apiClient.patch(`/kpi-assignments/approve/${kpiValueId}`, { status: 'Rejected', rejection_reason: reason });
      await new Promise((r) => setTimeout(r, 300)); // Fake delay
      await dispatch("fetchKpiUserAssignments", {
        kpiId: kpiIdToReload,
        context,
      });
      return true;
    } catch (error) {
      /* ... */ console.error("Error rejecting update:", error);
      throw error;
    } finally {
      /* ... */
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
