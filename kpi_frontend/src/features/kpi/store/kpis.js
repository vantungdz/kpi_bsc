import apiClient from "@/core/services/api";
import { notification } from "ant-design-vue";
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

  isSavingUserAssignment: false, // State mới cho saveUserAssignments
  saveUserAssignmentError: null, // State lỗi mới cho saveUserAssignments

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

  isSavingUserAssignment: (state) => state.isSavingUserAssignment, // Getter mới
  saveUserAssignmentError: (state) => state.saveUserAssignmentError, // Getter mới

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
    state.currentKpiUserAssignments = [...(assignments || [])];
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

  SET_SAVING_USER_ASSIGNMENT_LOADING(state, isLoading) {
    // Mutation mới
    state.isSavingUserAssignment = isLoading;
  },
  SET_SAVE_USER_ASSIGNMENT_ERROR(state, error) {
    // Mutation mới
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
  SET_TOGGLING_KPI_STATUS(state, isLoading) {
    state.isTogglingKpiStatus = isLoading;
  },
  SET_TOGGLE_KPI_STATUS_ERROR(state, error) {
    state.toggleKpiStatusError = error;
  },

  UPDATE_SINGLE_KPI_STATUS(state, { kpiId, newStatus }) {
    console.log(
      `Mutation UPDATE_SINGLE_KPI_STATUS: kpiId=${kpiId}, newStatus=${newStatus}`
    );
    const newAssignmentStatus =
      newStatus === KpiDefinitionStatus.APPROVED ? "APPROVED" : "DRAFT";

    if (state.currentKpi && state.currentKpi.id === kpiId) {
      console.log(`Updating currentKpi status and its assignments`);
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
      console.log(`Updating kpi status in kpis list at index ${kpiIndex}`);
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
    } else {
      console.log(`KPI ID ${kpiId} not found in kpis list state.`);
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
    commit("SET_SECTION_KPIS", null); // Reset data trước khi fetch

    try {
      // Lấy sectionIdForApi từ filterParams để đưa vào path của URL.
      // Tên thuộc tính này (sectionIdForApi) phải khớp với tên bạn đã đặt
      // trong component KpiListSection.vue khi gửi filtersToSend.
      const sectionIdInPath = filterParams.sectionIdForApi;

      // Tạo một bản sao của filterParams để làm queryParams.
      const queryParams = { ...filterParams };

      // Xóa sectionIdForApi khỏi queryParams vì nó đã được dùng trong path.
      delete queryParams.sectionIdForApi;

      // Ánh xạ departmentIdForQuery thành departmentId nếu backend KpiFilterDto mong đợi 'departmentId'.
      // Đồng thời, xóa departmentIdForQuery khỏi queryParams sau khi đã ánh xạ.
      if (
        queryParams.departmentIdForQuery !== undefined &&
        queryParams.departmentIdForQuery !== null
      ) {
        queryParams.departmentId = queryParams.departmentIdForQuery;
        delete queryParams.departmentIdForQuery;
      }
      // Các tham số khác như name, startDate, endDate sẽ được giữ nguyên nếu tên của chúng
      // trong filterParams (được truyền từ KpiListSection.vue) đã khớp với KpiFilterDto ở backend.
      // Ví dụ: nếu KpiListSection.vue gửi { name: "abc" }, và KpiFilterDto có thuộc tính `name`,
      // thì queryParams.name sẽ được gửi đi.

      const url = `/kpis/sections/${sectionIdInPath}`;

      const response = await apiClient.get(url, {
        params: queryParams, // Gửi các filter còn lại dưới dạng query parameters
      });

      // Mutation SET_SECTION_KPIS cần xử lý đúng cấu trúc response.data
      // (ví dụ: response.data có thể là { data: Kpi[], pagination: {...} } hoặc chỉ là Kpi[])
      commit("SET_SECTION_KPIS", response.data);

      return response.data; // Trả về dữ liệu để component có thể sử dụng nếu cần
    } catch (error) {
      console.error(
        "ACTION fetchSectionKpis: Lỗi khi fetch section KPIs:",
        error.response || error
      );
      commit("SET_ERROR", error);
      commit("SET_SECTION_KPIS", null); // Đặt lại data nếu có lỗi
      throw error; // Ném lỗi để component có thể bắt và xử lý
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
      let url = "/kpis/departments";
      if (
        departmentId !== null &&
        departmentId !== "" &&
        departmentId !== undefined
      ) {
        url += `/${departmentId}`;
      }
      // Remove departmentId from filters to avoid duplication
      const { ...queryFilters } = filters;
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

      let errorMessage = "Failed to delete KPI.";
      let errorDescription = error.response?.data?.message || error.message;

      if (error.response?.status === 403) {
        errorMessage = "No Permission";
        errorDescription =
          "You do not have permission to delete KPI, please contact admin or manager to do this.";
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
    commit("SET_SUBMITTING_DEPARTMENT_SECTION_ASSIGNMENT", true); // Đảm bảo mutation này tồn tại
    commit("SET_DEPARTMENT_SECTION_ASSIGNMENT_SAVE_ERROR", null); // Đảm bảo mutation này tồn tại
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
        error.response?.data?.message ||
        error.message ||
        "Failed to save assignment.";
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
      notification.success({ message: "User Assignment saved successfully!" });
      await dispatch("fetchKpiDetail", kpiId);
      return response.data;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to save user assignment.";
      commit("SET_SAVE_USER_ASSIGNMENT_ERROR", errorMsg); // Sử dụng mutation mới
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

    if (!kpiId || !assignmentId) {
      console.error("deleteUserAssignment: Missing kpiId or assignmentId");
      commit("SET_USER_DELETION_ERROR", "Thiếu ID cần thiết để xóa.");
      commit("SET_SUBMITTING_USER_DELETION", false);
      throw new Error("Thiếu ID cần thiết để xóa.");
    }

    try {
      await apiClient.delete(`/kpi-assignments/${assignmentId}`);
      notification.success({
        message: "User Assignment deleted successfully!",
      });

      try {
        await dispatch("fetchKpiDetail", kpiId);
        console.log(
          `[deleteUserAssignment] Refetched KPI Detail ${kpiId} after deleting assignment ${assignmentId}`
        );
      } catch (fetchError) {
        console.error(
          `[deleteUserAssignment] Error refetching KPI Detail ${kpiId} after delete:`,
          fetchError
        );
      }

      return true;
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to delete user assignment.";
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

  async toggleKpiStatus({ commit }, { kpiId }) {
    // Bỏ dispatch
    commit("SET_TOGGLING_KPI_STATUS", true);
    commit("SET_TOGGLE_KPI_STATUS_ERROR", null);
    try {
      // Gọi API, response chứa Kpi đã cập nhật status
      const response = await apiClient.patch(`/kpis/${kpiId}/toggle-status`);
      const updatedKpi = response.data;

      if (updatedKpi && updatedKpi.status) {
        // Chỉ cần commit mutation để cập nhật state đồng bộ
        commit("UPDATE_SINGLE_KPI_STATUS", {
          kpiId: kpiId,
          newStatus: updatedKpi.status,
        });
        notification.success({ message: "KPI status updated successfully!" });
        return updatedKpi;
      } else {
        throw new Error("Invalid response received after toggling status.");
      }
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        "Failed to toggle KPI status.";
      commit("SET_TOGGLE_KPI_STATUS_ERROR", errorMsg);
      notification.error({ message: "Update Failed", description: errorMsg });
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
