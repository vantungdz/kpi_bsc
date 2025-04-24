// src/store/modules/users.js
import apiClient from "../../services/api";

const state = {
  userList: [], // Danh sách user chung (có thể không cần nếu luôn fetch theo bộ lọc)
  usersBySection: {}, // Thêm state để lưu user theo Section ID
  usersByDepartment: {}, // <== THÊM: State để lưu user theo Department ID
  loading: false, // Thêm state loading chung
  error: null, // Thêm state error chung
};

const getters = {
  userList: (state) => state.userList, // Getter cho danh sách chung
  // Getter để lấy danh sách user theo Section ID
  usersBySection: (state) => (sectionId) =>
    state.usersBySection[String(sectionId)] || [],
  // <== THÊM: Getter để lấy danh sách user theo Department ID
  usersByDepartment: (state) => (departmentId) =>
    state.usersByDepartment[String(departmentId)] || [],
  isLoading: (state) => state.loading, // Getter cho loading
  error: (state) => state.error, // Getter cho error
};

const mutations = {
  SET_LOADING(state, isLoading) {
    state.loading = isLoading;
  },
  SET_ERROR(state, error) {
    state.error = error ? error.response?.data?.message || error.message : null;
  },
  SET_USERS(state, users) {
    state.userList = users; // Lưu danh sách user chung
  }, // Mutation để lưu danh sách user theo Section ID
  SET_USERS_BY_SECTION(state, { sectionId, users }) {
    console.log(
      `MUTATION SET_USERS_BY_SECTION called for section ${sectionId} with users:`,
      users
    );
    const key = String(sectionId);
    state.usersBySection = {
      ...state.usersBySection,
      [key]: users?.data || users || [], // <-- Dòng gán state
    };
    console.log(
      `MUTATION SET_USERS_BY_SECTION State AFTER assignment [${key}]:`,
      state.usersBySection[key]
    ); // <== THÊM LOG NÀY
    console.log(
      `MUTATION SET_USERS_BY_SECTION Full State AFTER assignment:`,
      state.usersBySection
    ); // <== THÊM LOG NÀY để xem toàn bộ object
  },
  // <== THÊM: Mutation để lưu danh sách user theo Department ID
  SET_USERS_BY_DEPARTMENT(state, { departmentId, users }) {
    console.log(
      `MUTATION SET_USERS_BY_DEPARTMENT called for department ${departmentId} with users:`,
      users
    );
    const key = String(departmentId);
    state.usersByDepartment = {
      ...state.usersByDepartment,
      [key]: users?.data || users || [],
    };
    console.log(
      `MUTATION SET_USERS_BY_DEPARTMENT State AFTER assignment [${key}]:`,
      state.usersByDepartment[key]
    ); // <== THÊM LOG NÀY
    console.log(
      `MUTATION SET_USERS_BY_DEPARTMENT Full State AFTER assignment:`,
      state.usersByDepartment
    ); // <== THÊM LOG NÀY
  },
};

const actions = {
  // Cập nhật action fetchUsers để nhận params và lưu vào state phù hợp
  async fetchUsers({ commit, state }, params = {}) {
    const hasSectionIdParam =
      typeof params.sectionId !== "undefined" && // Sử dụng tên param đúng từ frontend/API
      params.sectionId !== null &&
      params.sectionId !== "";

    const hasDepartmentIdParam =
      typeof params.departmentId !== "undefined" && // Sử dụng tên param đúng từ frontend/API
      params.departmentId !== null &&
      params.departmentId !== ""; // Nếu có section_id param và dữ liệu đã có trong state riêng
console.log("fetchUsers action: Condition variables check:");
console.log("  params:", params); // <== Log này
console.log("  hasSectionIdParam:", hasSectionIdParam); // <== Log này
console.log("  hasDepartmentIdParam:", hasDepartmentIdParam); // <== Log này
console.log("  Object.keys(params).length:", Object.keys(params).length);
    if (hasSectionIdParam && state.usersBySection[String(params.sectionId)]) {
      // Sử dụng tên param đúng
      console.log(
        `WorkspaceUsers: Users for section ${params.sectionId} already in state. Returning.` // Sử dụng tên param đúng
      );
      return state.usersBySection[String(params.sectionId)]; // Trả về từ state riêng
    }

    // <== THÊM: Nếu có departmentId param và dữ liệu đã có trong state riêng
    if (
      hasDepartmentIdParam &&
      state.usersByDepartment[String(params.departmentId)]
    ) {
      // Sử dụng tên param đúng
      console.log(
        `WorkspaceUsers: Users for department ${params.departmentId} already in state. Returning.` // Sử dụng tên param đúng
      );
      return state.usersByDepartment[String(params.departmentId)]; // Trả về từ state riêng
    } // Nếu không có params (params là rỗng) và danh sách chung đã có

    // Kiểm tra params rỗng bằng cách check cả sectionId và departmentId
    if (
      !hasSectionIdParam &&
      !hasDepartmentIdParam &&
      Object.keys(params).length === 0 &&
      state.userList.length > 0
    ) {
      console.log(
        "fetchUsers: No fetch needed (general user list). Returning."
      );
      return state.userList; // Trả về danh sách chung
    }

    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      console.log(
        "fetchUsers action: Calling API: GET /employees with params:",
        params
      ); // <== Log TRƯỚC API call
      const response = await apiClient.get("/employees", params); // <== Lệnh gọi API
      console.log("fetchUsers action: API call successful."); // <== Log NGAY SAU API call thành công

      const fetchedUsers = response.data?.data || response.data || [];
      console.log("fetchUsers action: Data received from API:", fetchedUsers);
      if (
        !hasSectionIdParam &&
        !hasDepartmentIdParam &&
        Object.keys(params).length === 0
      ) {
        // Nếu không có params, lưu vào danh sách chung
        console.log("fetchUsers action: Committing SET_USERS (general list)."); // <== THÊM LOG NÀY

        commit("SET_USERS", fetchedUsers);
      } else if (hasSectionIdParam) {
        // Nếu có sectionId param, lưu vào state riêng usersBySection
        console.log(
          `WorkspaceUsers action: Committing SET_USERS_BY_SECTION for section ${params.sectionId}.`
        ); // <== THÊM LOG NÀY

        commit("SET_USERS_BY_SECTION", {
          sectionId: params.sectionId, // Sử dụng tên param đúng
          users: fetchedUsers,
        });
      } else if (hasDepartmentIdParam) {
        // <== THÊM: Nếu có departmentId param, lưu vào state riêng usersByDepartment
        console.log(
          `WorkspaceUsers action: Committing SET_USERS_BY_DEPARTMENT for department ${params.departmentId}.`
        ); // <== THÊM LOG NÀY

        commit("SET_USERS_BY_DEPARTMENT", {
          departmentId: params.departmentId, // Sử dụng tên param đúng
          users: fetchedUsers,
        });
      } // Thêm các case khác nếu API hỗ trợ lọc theo các params khác
      console.log("fetchUsers action: Commit logic executed."); // <== Log sau commit logic

      return fetchedUsers; // Trả về dữ liệu fetch được
    } catch (error) {
      console.error("Error fetching users:", error.response || error);
      commit("SET_ERROR", error); // Clear state phù hợp khi lỗi
      if (
        !hasSectionIdParam &&
        !hasDepartmentIdParam &&
        Object.keys(params).length === 0
      ) {
        commit("SET_USERS", []);
      } else if (hasSectionIdParam) {
        commit("SET_USERS_BY_SECTION", {
          sectionId: params.sectionId, // Sử dụng tên param đúng
          users: [],
        });
      } else if (hasDepartmentIdParam) {
        // <== THÊM: Xóa state riêng khi lỗi fetch theo department
        commit("SET_USERS_BY_DEPARTMENT", {
          departmentId: params.departmentId, // Sử dụng tên param đúng
          users: [],
        });
      }
      throw error; // Rethrow error
    } finally {
      commit("SET_LOADING", false);
       console.log("fetchUsers action: Finally block executed.");
    }
  }, // Action riêng để fetch user theo Section ID, gọi lại action fetchUsers

  async fetchUsersBySection({ dispatch, state }, sectionId) {
    if (!sectionId) {
      console.warn("fetchUsersBySection: sectionId is required.");
      return Promise.resolve([]);
    } // Kiểm tra xem dữ liệu đã có trong state riêng chưa

    if (state.usersBySection[String(sectionId)]) {
      console.log(
        `WorkspaceUsersBySection: Users for section ${sectionId} already in state.`
      );
      return Promise.resolve(state.usersBySection[String(sectionId)]); // Trả về từ state
    }

    console.log(
      `WorkspaceUsersBySection: Fetching users for section ${sectionId}.`
    ); // Gọi action fetchUsers với params sectionId
    return dispatch("fetchUsers", { params: { sectionId: sectionId } }); // Sử dụng tên param đúng
  },

  // <== THÊM: Action riêng để fetch user theo Department ID
  async fetchUsersByDepartment({ dispatch, state }, departmentId) {
    if (!departmentId) {
      console.warn("fetchUsersByDepartment: departmentId is required.");
      return Promise.resolve([]);
    }

    // Kiểm tra xem dữ liệu đã có trong state riêng chưa
    if (state.usersByDepartment[String(departmentId)]) {
      // Sử dụng state riêng department
      console.log(
        `WorkspaceUsersByDepartment: Users for department ${departmentId} already in state.`
      );
      return Promise.resolve(state.usersByDepartment[String(departmentId)]); // Trả về từ state
    }

    console.log(
      `WorkspaceUsersByDepartment: Fetching users for department ${departmentId}.`
    );
    // Gọi action fetchUsers với params departmentId
    return dispatch("fetchUsers", { params: { departmentId: departmentId } }); // Sử dụng tên param đúng
  }, // Có thể thêm các actions khác như fetchUserById, createUser, updateUser, v.v.
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
