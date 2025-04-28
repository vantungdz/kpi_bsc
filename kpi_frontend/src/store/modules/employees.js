// src/store/modules/users.js
import apiClient from "../../services/api";

const state = {
  userList: [],
  usersBySection: {},
  usersByDepartment: {},
  loading: false,
  error: null,
};

const getters = {
  userList: (state) => state.userList,
  usersBySection: (state) => (sectionId) =>
    state.usersBySection[String(sectionId)] || [],
  usersByDepartment: (state) => (departmentId) =>
    state.usersByDepartment[String(departmentId)] || [],
  isLoading: (state) => state.loading,
  error: (state) => state.error,
};

const mutations = {
  SET_LOADING(state, isLoading) {
    state.loading = isLoading;
  },
  SET_ERROR(state, error) {
    state.error = error ? error.response?.data?.message || error.message : null;
  },
  SET_USERS(state, users) {
    state.userList = users;
  },
  SET_USERS_BY_SECTION(state, { sectionId, users }) {
    console.log(
      `MUTATION SET_USERS_BY_SECTION called for section ${sectionId} with users:`,
      users
    );
    const key = String(sectionId);
    state.usersBySection = {
      ...state.usersBySection, // Lưu trực tiếp mảng users đã được xử lý ở action
      [key]: users,
    };
  },
  SET_USERS_BY_DEPARTMENT(state, { departmentId, users }) {
    console.log(
      `MUTATION SET_USERS_BY_DEPARTMENT called for department ${departmentId} with users:`,
      users
    );
    const key = String(departmentId);
    state.usersByDepartment = {
      ...state.usersByDepartment, // Lưu trực tiếp mảng users đã được xử lý ở action
      [key]: users,
    };
  },
};

const actions = {
  // params bây giờ sẽ là object chứa query params, ví dụ: { sectionId: 1 } hoặc { departmentId: 2 }
  async fetchUsers({ commit, state }, params = {}) {
    // Truy cập tham số trực tiếp từ object params
    const sectionIdParam = params.sectionId;
    const departmentIdParam = params.departmentId;

    const hasSectionIdParam =
      typeof sectionIdParam !== "undefined" &&
      sectionIdParam !== null &&
      sectionIdParam !== "";
    const hasDepartmentIdParam =
      typeof departmentIdParam !== "undefined" &&
      departmentIdParam !== null &&
      departmentIdParam !== "";
    if (
      hasSectionIdParam &&
      state.usersBySection[String(sectionIdParam)]?.length > 0
    ) {
      console.log(
        `WorkspaceUsers: Users for section ${sectionIdParam} already in state.`
      );
      return state.usersBySection[String(sectionIdParam)];
    }

    if (
      hasDepartmentIdParam &&
      state.usersByDepartment[String(departmentIdParam)]?.length > 0
    ) {
      console.log(
        `WorkspaceUsers: Users for department ${departmentIdParam} already in state.`
      );
      return state.usersByDepartment[String(departmentIdParam)];
    }

    // Kiểm tra nếu params là rỗng để fetch danh sách chung
    const isGeneralFetch =
      !hasSectionIdParam &&
      !hasDepartmentIdParam &&
      Object.keys(params).length === 0;
    if (isGeneralFetch && state.userList.length > 0) {
      console.log(
        "fetchUsers: No fetch needed (general user list). Returning."
      );
      return state.userList;
    }

    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      console.log(
        "fetchUsers action: Calling API: GET /employees with params:",
        params
      ); // Truyền object params trực tiếp cho apiClient.get
      // Giả định apiClient (Axios) sẽ tự động thêm ?key=value
      const response = await apiClient.get("/employees", { params }); //
      // Trích xuất dữ liệu mảng user từ response

      const fetchedUsers = response.data?.data || response.data || [];
      console.log("fetchUsers action: Data received from API:", fetchedUsers); // Commit dữ liệu dựa trên tham số nào được cung cấp

      if (isGeneralFetch) {
        console.log("fetchUsers action: Committing SET_USERS (general list).");
        commit("SET_USERS", fetchedUsers);
      } else if (hasSectionIdParam) {
        console.log(
          `WorkspaceUsers action: Committing SET_USERS_BY_SECTION for section ${sectionIdParam}.`
        );
        commit("SET_USERS_BY_SECTION", {
          sectionId: sectionIdParam, // Sử dụng giá trị tham số
          users: fetchedUsers, // Commit mảng user
        });
      } else if (hasDepartmentIdParam) {
        console.log(
          `WorkspaceUsers action: Committing SET_USERS_BY_DEPARTMENT for department ${departmentIdParam}.`
        );
        commit("SET_USERS_BY_DEPARTMENT", {
          departmentId: departmentIdParam, // Sử dụng giá trị tham số
          users: fetchedUsers, // Commit mảng user
        });
      } else {
        console.warn(
          "fetchUsers action: API call with unexpected params, data not committed to specific state.",
          params
        );
      }
      console.log("fetchUsers action: Commit logic executed.");

      return fetchedUsers; // Trả về dữ liệu fetch được
    } catch (error) {
      console.error("Error fetching users:", error.response || error);
      commit("SET_ERROR", error); // Xóa state tương ứng khi có lỗi fetch
      if (isGeneralFetch) {
        commit("SET_USERS", []);
      } else if (hasSectionIdParam) {
        commit("SET_USERS_BY_SECTION", {
          sectionId: sectionIdParam,
          users: [],
        });
      } else if (hasDepartmentIdParam) {
        commit("SET_USERS_BY_DEPARTMENT", {
          departmentId: departmentIdParam,
          users: [],
        });
      }
      throw error; // Rethrow error
    } finally {
      commit("SET_LOADING", false);
      console.log("fetchUsers action: Finally block executed.");
    }
  }, // Action helper gọi fetchUsers với sectionId

  async fetchUsersBySection({ dispatch, state }, sectionId) {
    if (!sectionId) {
      console.warn("fetchUsersBySection: sectionId is required.");
      return [];
    } // Kiểm tra cache - cải thiện
    if (state.usersBySection[String(sectionId)]?.length > 0) {
      console.log(
        `WorkspaceUsersBySection: Users for section ${sectionId} already in state.`
      );
      return state.usersBySection[String(sectionId)];
    }

    console.log(
      `WorkspaceUsersBySection: Fetching users for section ${sectionId}.`
    ); // Truyền object { sectionId: sectionId } trực tiếp làm params cho fetchUsers
    return dispatch("fetchUsers", { sectionId: sectionId });
  }, // Action helper gọi fetchUsers với departmentId

  async fetchUsersByDepartment({ dispatch, state }, departmentId) {
    if (!departmentId) {
      console.warn("fetchUsersByDepartment: departmentId is required.");
      return [];
    } // Kiểm tra cache - cải thiện
    if (state.usersByDepartment[String(departmentId)]?.length > 0) {
      console.log(
        `WorkspaceUsersByDepartment: Users for department ${departmentId} already in state.`
      );
      return state.usersByDepartment[String(departmentId)];
    }

    console.log(
      `WorkspaceUsersByDepartment: Fetching users for department ${departmentId}.`
    ); // Truyền object { departmentId: departmentId } trực tiếp làm params cho fetchUsers
    return dispatch("fetchUsers", { departmentId: departmentId });
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
