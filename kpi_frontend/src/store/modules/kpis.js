// store/modules/kpis.js
// Đã refactor, tích hợp API User Assignment, My Assignment, Submit Update, Save/Delete Assignments

import apiClient from "../../services/api";
import { notification } from "ant-design-vue"; // Assuming you're using Ant Design Vue for notifications
// import router from "../../router"; // Import nếu cần

const state = {
  kpis: [], // Danh sách KPI chung (có phân trang)
  kpisAllForSelect: [], // Danh sách KPI rút gọn cho select box
  sectionKpiList: [], // Danh sách KPI theo Section (từ fetchSectionKpis)
  departmentKpiList: [], // Danh sách KPI theo Department (từ fetchDepartmentKpis)
  currentKpi: null, // KPI đang xem chi tiết

  // === State cho User Assignments của currentKpi (fetch từ /kpis/:id/assignments) ===
  currentKpiUserAssignments: [], // Danh sách user assignments của KPI đang xem
  loadingUserAssignments: false, // Loading riêng cho user assignment của currentKpi
  userAssignmentError: null, // Lỗi riêng cho user assignment của currentKpi

  // === State cho My Assignments (KPI cá nhân - fetch từ /kpis/employees/:userId) ===
  myAssignments: [],
  loadingMyAssignments: false,
  myAssignmentsError: null,

  // === State cho Submit Progress Update (Post lên /kpi-assignments/:assignmentId/updates) ===
  submittingUpdate: false,
  submitUpdateError: null,

  // === State cho Save Department/Section Assignments (Post lên /kpis/:kpiId/sections/assignments hoặc /kpis/:kpiId/assignments) ===
  submittingDepartmentSectionAssignment: false, // Loading khi save
  departmentSectionAssignmentSaveError: null, // Lỗi khi save (đổi tên cho rõ hơn)

  // === State cho Delete Department/Section Assignment (Delete lên /kpi-assignments/:assignmentId) ===
  submittingDepartmentSectionDeletion: false, // <== THÊM: Loading khi xóa Dept/Section Assignment
  departmentSectionDeletionError: null, // <== THÊM: Lỗi khi xóa Dept/Section Assignment

  // === State cho Delete User Assignment (Delete lên /kpi-assignments/:assignmentId) ===
  submittingUserDeletion: false, // <== THÊM: Loading khi xóa User Assignment
  userDeletionError: null, // <== THÊM: Lỗi khi xóa User Assignment (đổi tên cho rõ hơn userAssignmentError)

  // === State chung ===
  loading: false, // Loading chính (fetch list, detail KPI)
  loadingAll: false, // Loading cho fetchAllKpisForSelect
  error: null, // Lỗi chung (ví dụ: fetch list/detail thất bại)

  pagination: {
    // Pagination cho danh sách chung
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    itemsPerPage: 10,
  },

  // === State cho Approval (Placeholder) ===
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
  currentKpiUserAssignments: (state) => state.currentKpiUserAssignments, // <== Sửa tên state
  isLoadingUserAssignments: (state) => state.loadingUserAssignments,
  userAssignmentError: (state) => state.userAssignmentError,

  // Getters cho My Assignments
  myAssignments: (state) => state.myAssignments,
  isLoadingMyAssignments: (state) => state.loadingMyAssignments,
  myAssignmentsError: (state) => state.myAssignmentsError,

  // Getters cho Submit Progress Update
  isSubmittingUpdate: (state) => state.submittingUpdate,
  submitUpdateError: (state) => state.submitUpdateError,

  // <== THÊM: Getters cho Save Department/Section Assignments
  isSubmittingDepartmentSectionAssignment: (state) =>
    state.submittingDepartmentSectionAssignment,
  departmentSectionAssignmentSaveError: (state) =>
    state.departmentSectionAssignmentSaveError, // <== Getter cho lỗi save

  // <== THÊM: Getters cho Delete Department/Section Assignment
  isSubmittingDepartmentSectionDeletion: (state) =>
    state.submittingDepartmentSectionDeletion,
  departmentSectionDeletionError: (state) =>
    state.departmentSectionDeletionError, // <== Getter cho lỗi delete

  // <== THÊM: Getters cho Delete User Assignment
  isSubmittingUserDeletion: (state) => state.submittingUserDeletion,
  userDeletionError: (state) => state.userDeletionError, // <== Getter cho lỗi delete user

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

  // Mutations cho User Assignment (fetch từ /kpis/:id/assignments)
  SET_USER_ASSIGNMENT_LOADING(state, isLoading) {
    state.loadingUserAssignments = isLoading;
  },
  SET_USER_ASSIGNMENT_ERROR(state, error) {
    state.userAssignmentError = error
      ? error.response?.data?.message ||
        error.message ||
        "An assignment fetch error occurred" // Sửa message cho rõ
      : null;
  },
  SET_KPI_USER_ASSIGNMENTS(state, assignments) {
    state.currentKpiUserAssignments = assignments || []; // <== Sửa tên state
  },

  // Mutations cho My Assignments (/kpis/employees/:userId)
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

  // Mutations cho Submit Progress Update (/kpi-assignments/:assignmentId/updates)
  SET_SUBMIT_UPDATE_LOADING(state, isLoading) {
    state.submittingUpdate = isLoading;
  },
  SET_SUBMIT_UPDATE_ERROR(state, error) {
    state.submitUpdateError = error
      ? error.response?.data?.message || error.message
      : null;
  },

  // <== THÊM: Mutations cho Save Department/Section Assignments
  SET_SUBMITTING_DEPARTMENT_SECTION_ASSIGNMENT(state, isLoading) {
    state.submittingDepartmentSectionAssignment = isLoading;
  },
  SET_DEPARTMENT_SECTION_ASSIGNMENT_SAVE_ERROR(state, error) {
    // <== Sửa tên mutation lỗi
    state.departmentSectionAssignmentSaveError = error
      ? error.response?.data?.message ||
        error.message ||
        "An error occurred while saving assignment."
      : null;
  },

  // <== THÊM: Mutations cho Delete Department/Section Assignment
  SET_SUBMITTING_DEPARTMENT_SECTION_DELETION(state, isLoading) {
    state.submittingDepartmentSectionDeletion = isLoading;
  },
  SET_DEPARTMENT_SECTION_DELETION_ERROR(state, error) {
    // <== THÊM MUTATION LỖI RIÊNG
    state.departmentSectionDeletionError = error
      ? error.response?.data?.message ||
        error.message ||
        "An unknown deletion error occurred"
      : null;
  },

  // <== THÊM: Mutations cho Delete User Assignment
  SET_SUBMITTING_USER_DELETION(state, isLoading) {
    // <== THÊM Mutation Loading riêng
    state.submittingUserDeletion = isLoading;
  },
  SET_USER_DELETION_ERROR(state, error) {
    // <== THÊM Mutation Error riêng (đổi tên)
    state.userDeletionError = error
      ? error.response?.data?.message ||
        error.message ||
        "An error occurred while deleting user assignment."
      : null;
  },

  // Mutations cho KPI CRUD
  SET_KPIS(state, kpiData) {
    state.kpis = kpiData?.data?.data || []; // Handle nested data structure
    state.pagination = {
      // Handle pagination structure
      currentPage: kpiData?.data?.pagination?.currentPage || 1,
      totalPages: kpiData?.data?.pagination?.totalPages || 0,
      totalItems: kpiData?.data?.pagination?.totalItems || 0,
      itemsPerPage: kpiData?.data?.pagination?.itemsPerPage || 10,
    };
  },
  // SET_SECTION_KPIS và SET_DEPARTMENT_KPI_LIST cần kiểm tra cấu trúc response
  SET_SECTION_KPIS(state, resData) {
    state.sectionKpiList = resData ? resData.data : []; // Assuming data is directly in res.data
  },
  SET_DEPARTMENT_KPI_LIST(state, resData) {
    state.departmentKpiList = resData; // Assuming data is directly in resData
  },

  SET_KPIS_ALL_FOR_SELECT(state, kpis) {
    // Assuming this endpoint returns a flat array or { data: [] }
    state.kpisAllForSelect = kpis?.data || kpis || [];
  },
  SET_CURRENT_KPI(state, kpi) {
    state.currentKpi = kpi; // Assuming kpi is the direct KPI object with relations
    // Reset user assignments khi đổi KPI
    state.currentKpiUserAssignments = []; // <== Sửa tên state
    // Bỏ reset section assignments
    // state.currentKpiSectionAssignments = [];
  },
  ADD_KPI(state, kpi) {
    if (!kpi) return;
    state.kpis.unshift(kpi); // Add to the beginning of the list
    state.pagination.totalItems++; // Increment total items
    // Add to select list if needed immediately
    state.kpisAllForSelect.unshift({
      id: kpi.id,
      name: kpi.name,
      path: kpi.path,
    });
  },
  UPDATE_KPI(state, updatedKpi) {
    if (!updatedKpi) return;
    // Update in main list
    const index = state.kpis.findIndex((k) => k.id === updatedKpi.id);
    if (index !== -1) state.kpis.splice(index, 1, updatedKpi);
    // Update in select list
    const indexAll = state.kpisAllForSelect.findIndex(
      (k) => k.id === updatedKpi.id
    );
    if (indexAll !== -1)
      state.kpisAllForSelect.splice(indexAll, 1, {
        id: updatedKpi.id,
        name: updatedKpi.name,
        path: updatedKpi.path,
      });
    // Update current KPI if it's the same
    if (state.currentKpi && state.currentKpi.id === updatedKpi.id) {
      state.currentKpi = { ...state.currentKpi, ...updatedKpi };
    }
  },
  REMOVE_KPI(state, kpiId) {
    // Remove from main list
    state.kpis = state.kpis.filter((k) => k.id !== kpiId);
    // Remove from select list
    state.kpisAllForSelect = state.kpisAllForSelect.filter(
      (k) => k.id !== kpiId
    );
    // Decrement total items, ensure not negative
    if (state.pagination.totalItems > 0) state.pagination.totalItems--;
    // Clear current KPI if it's the one deleted
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
      commit("SET_KPIS", response.data); // Assuming response.data is { data: [...], pagination: {...} }
      return response.data; // Return full response data for pagination
    } catch (error) {
      commit("SET_ERROR", error);
      commit("SET_KPIS", null); // Clear list state on error
      throw error; // Re-throw
    } finally {
      commit("SET_LOADING", false);
    }
  },
  // Need to verify return structure of these endpoints and mutations
  async fetchSectionKpis({ commit }, id) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    commit("SET_SECTION_KPIS", null);
    try {
      const response = await apiClient.get(`/kpis/sections/${id}`);
      commit("SET_SECTION_KPIS", response.data);
      return response.data;
    } catch (error) {
      commit("SET_ERROR", error);
      commit("SET_SECTION_KPIS", null); // Clear state on error
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },
  // Need to verify return structure of these endpoints and mutations
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
      commit("SET_DEPARTMENT_KPI_LIST", null); // Clear state on error
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  // Action riêng để lấy danh sách rút gọn cho dropdown Parent KPI
  async fetchAllKpisForSelect({ commit, state }, forceRefresh = false) {
    // Assuming fetchKpis handles limit: 1000 and fields filter via params
    // If general fetchKpis is paginated, this needs a specific backend endpoint or large limit
    if (state.kpisAllForSelect.length > 0 && !forceRefresh)
      return state.kpisAllForSelect; // Return cached data
    commit("SET_LOADING_ALL", true);
    commit("SET_ERROR", null); // Use general error for this fetch
    try {
      // Adjust params based on actual backend API for select list
      const response = await apiClient.get("/kpis", {
        params: { limit: 1000, fields: "id,name,path" }, // Example params
      });
      const kpis = response.data?.data || response.data || []; // Handle potential nested data
      commit("SET_KPIS_ALL_FOR_SELECT", kpis);
      return kpis; // Return fetched data
    } catch (error) {
      commit("SET_ERROR", error); // Set general error state
      commit("SET_KPIS_ALL_FOR_SELECT", []); // Clear state on error
      throw error; // Re-throw
    } finally {
      commit("SET_LOADING_ALL", false);
    }
  },

  async fetchKpiDetail({ commit }, id) {
    commit("SET_LOADING", true); // Set main loading
    commit("SET_ERROR", null); // Clear general error
    // Clear assignment errors/loading states that belong to the old KPI
    commit("SET_USER_ASSIGNMENT_LOADING", false);
    commit("SET_USER_ASSIGNMENT_ERROR", null);
    commit("SET_SUBMITTING_DEPARTMENT_SECTION_DELETION", false); // Clear delete state
    commit("SET_DEPARTMENT_SECTION_DELETION_ERROR", null); // Clear delete error state
    commit("SET_SUBMITTING_USER_DELETION", false); // Clear user delete state
    commit("SET_USER_DELETION_ERROR", null); // Clear user delete error state

    commit("SET_CURRENT_KPI", null); // Clear current KPI data immediately
    try {
      // API: GET /kpis/:id - Should return KPI object with eager loaded relations (perspective, assignments)
      const response = await apiClient.get(`/kpis/${id}`);
      commit("SET_CURRENT_KPI", response.data); // Assuming response.data is the direct KPI object
      return response.data; // Return the fetched KPI object
    } catch (error) {
      commit("SET_ERROR", error); // Set general error state
      commit("SET_CURRENT_KPI", null); // Clear state on error
      console.error("Error fetching KPI detail:", error.response || error);
      throw error; // Re-throw
    } finally {
      commit("SET_LOADING", false); // Clear main loading
    }
  },

  // Need to verify backend create endpoint payload and response
  async createKpi({ commit }, kpiData) {
    commit("SET_LOADING", true); // Use main loading for creation
    commit("SET_ERROR", null); // Use general error for creation
    try {
      // API: POST /kpis/createKpi (assuming this endpoint exists and handles creation + initial assignments)
      // Payload structure depends on backend DTO
      const response = await apiClient.post("/kpis/createKpi", kpiData);
      // Assuming response.data is the newly created KPI object
      commit("ADD_KPI", response.data); // Add the new KPI to the list
      return response.data; // Return the created KPI object
    } catch (error) {
      commit("SET_ERROR", error); // Set general error state
      console.error("Error creating KPI:", error.response || error);
      throw error; // Re-throw
    } finally {
      commit("SET_LOADING", false); // Clear main loading
    }
  },

  async updateKpi({ commit }, { id, kpiData }) {
    commit("SET_LOADING", true); // Use main loading for update
    commit("SET_ERROR", null); // Use general error for update
    try {
      // API: PATCH /kpis/:id
      const response = await apiClient.patch(`/kpis/${id}`, kpiData);
      // Assuming response.data is the updated KPI object
      commit("UPDATE_KPI", response.data); // Update the KPI in the list and current KPI
      return response.data; // Return the updated KPI object
    } catch (error) {
      commit("SET_ERROR", error); // Set general error state
      console.error("Error updating KPI:", error.response || error);
      throw error; // Re-throw
    } finally {
      commit("SET_LOADING", false); // Clear main loading
    }
  },

  async deleteKpi({ commit }, id) {
    commit("SET_LOADING", true); // Use main loading for deletion
    commit("SET_ERROR", null); // Use general error for deletion
    try {
      // API: DELETE /kpis/:id (Assuming soft delete is handled by backend entity/service)
      await apiClient.delete(`/kpis/${id}`);
      commit("REMOVE_KPI", id); // Remove KPI from state lists
      notification.success({ message: "KPI deleted successfully!" }); // Success notification
      return true; // Indicate success
    } catch (error) {
      commit("SET_ERROR", error); // Set general error state
      console.error("Error deleting KPI:", error.response || error);
      notification.error({
        message: "Failed to delete KPI.",
        description: error.response?.data?.message || error.message,
      }); // Error notification
      throw error; // Re-throw
    } finally {
      commit("SET_LOADING", false); // Clear main loading
    }
  },

  // === ACTIONS QUẢN LÝ USER ASSIGNMENT (Fetch từ /kpis/:id/assignments) ===
  // This fetches all assignments for a KPI, frontend filters them into user/dept/section/team
  async fetchKpiUserAssignments({ commit }, kpiId) {
    if (!kpiId) {
      console.warn("fetchKpiUserAssignments: kpiId is required.");
      commit("SET_KPI_USER_ASSIGNMENTS", []); // Clear list if no ID
      return [];
    }
    commit("SET_USER_ASSIGNMENT_LOADING", true); // Use specific loading
    commit("SET_USER_ASSIGNMENT_ERROR", null); // Clear specific error
    // commit("SET_KPI_USER_ASSIGNMENTS", []); // Optionally clear list before fetch

    try {
      // API: GET /kpis/:id/assignments - Should return array of KPIAssignment objects with eager loaded relations
      const response = await apiClient.get(`/kpis/${kpiId}/assignments`);
      const assignments = response.data?.data || response.data || []; // Assuming array is direct or in .data
      commit("SET_KPI_USER_ASSIGNMENTS", assignments); // Set list
      return assignments; // Return fetched data
    } catch (error) {
      commit("SET_USER_ASSIGNMENT_ERROR", error); // Set specific error state
      commit("SET_KPI_USER_ASSIGNMENTS", []); // Clear list state on error
      console.error(
        "Error fetching user assignments:",
        error.response || error
      );
      throw error; // Re-throw
    } finally {
      commit("SET_USER_ASSIGNMENT_LOADING", false); // Clear specific loading
    }
  },

  // === ACTIONS QUẢN LÝ SAVE ASSIGNMENT (POST lên /kpis/:kpiId/assignments hoặc /kpis/:kpiId/sections/assignments) ===
  // This action seems to save mixed assignment types (user, dept, section) based on frontend payload structure
  // Need to verify backend endpoint that accepts this payload
  async saveDepartmentSectionAssignment( // Frontend calls this for Dept/Section modal save
    { commit, dispatch },
    { kpiId, assignmentsPayload } // Payload likely contains { assignments: [ { assigned_to_department, assigned_to_section, targetValue, weight } ] }
  ) {
    commit("SET_SUBMITTING_DEPARTMENT_SECTION_ASSIGNMENT", true); // Use specific loading
    commit("SET_DEPARTMENT_SECTION_ASSIGNMENT_SAVE_ERROR", null); // Clear specific error
    try {
      // Sửa endpoint API call để gọi đúng endpoint lưu Section/Department assignments
      // Endpoint backend là POST /kpis/:id/sections/assignments
      const response = await apiClient.post(
        `/kpis/${kpiId}/sections/assignments`, // <== SỬA Ở ĐÂY
        assignmentsPayload // <== Payload { assignments: [{ assigned_to_department, assigned_to_section, targetValue, weight }] }
      );
      notification.success({ message: "Assignment saved successfully!" });

      await dispatch("fetchKpiUserAssignments", kpiId); // Refresh assignments list displayed in tables

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

  // This action saves User assignments specifically
  // Frontend calls this for User modal save
  // Backend has POST /kpis/:id/assignments calling saveUserAssignments
  async saveUserAssignments(
    { commit, dispatch },
    { kpiId, assignmentsPayload } // Payload likely { assignments: [{ user_id, target, weight }] }
  ) {
    // Re-using submittingUserAssignment loading/error from initial state for user save/delete
    commit("SET_SUBMITTING_USER_DELETION", true); // Re-use loading state
    commit("SET_USER_DELETION_ERROR", null); // Re-use error state (re-purposing for save/delete)

    try {
      // API: POST /kpis/:id/assignments (Assuming this endpoint handles user assignment saving)
      // Need to verify backend expects payload with weight
      const response = await apiClient.post(
        `/kpis/${kpiId}/assignments`, // <== Endpoint assumption
        assignmentsPayload // <== Payload { assignments: [{ user_id, target, weight }] }
      );
      notification.success({ message: "User Assignment saved successfully!" }); // Success notification

      // Refresh assignments list after save
      await dispatch("fetchKpiUserAssignments", kpiId); // Refresh the list displayed in tables

      return response.data; // Return API response data
    } catch (error) {
      // Use specific error state for user save/delete
      commit("SET_USER_DELETION_ERROR", error); // Set specific error state
      console.error("Error saving user assignment:", error.response || error);
      notification.error({
        message: "Failed to save user assignment.",
        description: error.response?.data?.message || error.message,
      }); // Error notification
      throw error; // Re-throw
    } finally {
      commit("SET_SUBMITTING_USER_DELETION", false); // Clear loading
    }
  },

  // === ACTIONS QUẢN LÝ DELETE ASSIGNMENT (DELETE lên /kpi-assignments/:assignmentId) ===

  // Action to delete Department/Section assignment
  async deleteDepartmentSectionAssignment(
    { commit, dispatch },
    { assignmentId, kpiId }
  ) {
    // Frontend passes kpiId, action uses it for refresh
    commit("SET_SUBMITTING_DEPARTMENT_SECTION_DELETION", true); // Use specific loading
    commit("SET_DEPARTMENT_SECTION_DELETION_ERROR", null); // <== Use dedicated error state

    try {
      // API: DELETE /kpi-assignments/:id (Endpoint matches controller)
      await apiClient.delete(`/kpi-assignments/${assignmentId}`);

      notification.success({ message: "Assignment deleted successfully!" }); // Success notification

      // Refresh assignments list after delete
      await dispatch("fetchKpiUserAssignments", kpiId); // Refresh the list displayed in tables

      return true; // Indicate success (API returns void)
    } catch (error) {
      commit("SET_DEPARTMENT_SECTION_DELETION_ERROR", error); // <== Use dedicated error state
      console.error(
        "Error deleting department/section assignment:",
        error.response || error
      );
      notification.error({
        message: "Failed to delete assignment.",
        description: error.response?.data?.message || error.message,
      }); // Error notification
      throw error; // Re-throw
    } finally {
      commit("SET_SUBMITTING_DEPARTMENT_SECTION_DELETION", false); // Clear specific loading
    }
  },

  // Action to delete User assignment
  async deleteUserAssignment({ commit, dispatch }, { kpiId, assignmentId }) {
    // Frontend passes kpiId, action uses it for refresh
    commit("SET_SUBMITTING_USER_DELETION", true); // Use specific loading
    commit("SET_USER_DELETION_ERROR", null); // <== Use dedicated error state

    try {
      // API: DELETE /kpi-assignments/:id (Endpoint matches controller)
      await apiClient.delete(`/kpi-assignments/${assignmentId}`);

      notification.success({
        message: "User Assignment deleted successfully!",
      }); // Success notification

      // Refresh assignments list after delete
      await dispatch("fetchKpiUserAssignments", kpiId); // Refresh the list displayed in tables

      return true; // Indicate success (API returns void)
    } catch (error) {
      commit("SET_USER_DELETION_ERROR", error); // <== Use dedicated error state
      console.error("Error deleting user assignment:", error.response || error);
      notification.error({
        message: "Failed to delete user assignment.",
        description: error.response?.data?.message || error.message,
      }); // Error notification
      throw error; // Re-throw
    } finally {
      commit("SET_SUBMITTING_USER_DELETION", false); // Clear specific loading
    }
  },

  // === ACTION LẤY KPI CỦA CÁ NHÂN TÔI (/kpis/employees/:userId) ===
  async fetchMyAssignments({ commit }, userId) {
    if (!userId) {
      console.warn("fetchMyAssignments: userId is required.");
      commit("SET_MY_ASSIGNMENTS", []); // Clear list if no ID
      return [];
    }
    commit("SET_MY_ASSIGNMENTS_LOADING", true); // Use specific loading
    commit("SET_MY_ASSIGNMENTS_ERROR", null); // Clear specific error
    // commit("SET_MY_ASSIGNMENTS", []); // Optionally clear list before fetch

    try {
      // API: GET /kpis/employees/:userId - Assuming this endpoint returns a list of KPI objects filtered by employee assignment
      const response = await apiClient.get(`/kpis/employees/${userId}`);
      // Assuming response.data.data or response.data is the array of KPI objects
      const assignments = response.data?.data || response.data || [];
      commit("SET_MY_ASSIGNMENTS", assignments); // Set list
      return assignments; // Return fetched data
    } catch (error) {
      commit("SET_MY_ASSIGNMENTS_ERROR", error); // Set specific error state
      commit("SET_MY_ASSIGNMENTS", []); // Clear list state on error
      console.error("Error fetching my assignments:", error.response || error);
      throw error; // Re-throw
    } finally {
      commit("SET_MY_ASSIGNMENTS_LOADING", false); // Clear specific loading
    }
  },

  // === ACTION GỬI UPDATE TIẾN ĐỘ (POST lên /kpi-assignments/:assignmentId/updates) ===
  async submitKpiUpdate({ commit }, { assignmentId, updateData }) {
    // updateData likely { notes, project_details }
    commit("SET_SUBMIT_UPDATE_LOADING", true); // Use specific loading
    commit("SET_SUBMIT_UPDATE_ERROR", null); // Clear specific error

    try {
      // API: POST /kpi-assignments/:assignmentId/updates (Endpoint matches controller)
      const response = await apiClient.post(
        `/kpi-assignments/${assignmentId}/updates`,
        updateData
      );
      notification.success({
        message: "Progress update submitted successfully!",
      }); // Success notification

      // Refresh assignment detail/list if needed after submitting update?
      // This action just submits, refreshing might be done by the component or another action

      return response.data; // Return API response data
    } catch (error) {
      commit("SET_SUBMIT_UPDATE_ERROR", error); // Set specific error state
      console.error("Error submitting KPI update:", error.response || error);
      notification.error({
        message: "Failed to submit progress update.",
        description: error.response?.data?.message || error.message,
      }); // Error notification
      throw error; // Re-throw
    } finally {
      commit("SET_SUBMIT_UPDATE_LOADING", false); // Clear specific loading
    }
  },

  // === ACTIONS CHO APPROVAL (Placeholder) ===
  // async fetchApprovalItemDetails({ commit }, assignmentId) { ... },
  // async approveUpdate({ commit, dispatch }, { kpiValueId, kpiIdToReload, context }) { ... },
  // async rejectUpdate({ commit, dispatch }, { kpiValueId, kpiIdToReload, context }) { ... },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
