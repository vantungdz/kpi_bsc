// src/store/modules/users.js
import apiClient from "../../services/api";

const state = {
  userList: [], // Danh sách user chung (có thể không cần nếu luôn fetch theo bộ lọc)
  usersBySection: {}, // Thêm state để lưu user theo Section ID
  loading: false, // Thêm state loading chung
  error: null, // Thêm state error chung
};

const getters = {
  userList: (state) => state.userList, // Getter cho danh sách chung
  // Getter để lấy danh sách user theo Section ID
  usersBySection: (state) => (sectionId) =>
    state.usersBySection[String(sectionId)] || [],
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
  },
  // Mutation để lưu danh sách user theo Section ID
  SET_USERS_BY_SECTION(state, { sectionId, users }) {
    const key = String(sectionId);
    state.usersBySection = {
      ...state.usersBySection,
      [key]: users?.data || users || [],
    };
    console.log(
      `MUTATION SET_USERS_BY_SECTION called for section ${sectionId}. State updated.`
    );
  },
};

const actions = {
  // Cập nhật action fetchUsers để nhận params và lưu vào state phù hợp
  async fetchUsers({ commit, state }, params = {}) {
    const hasSectionIdParam =
      typeof params.section_id !== "undefined" &&
      params.section_id !== null &&
      params.section_id !== "";

    // Nếu có section_id param và dữ liệu đã có trong state riêng
    if (hasSectionIdParam && state.usersBySection[String(params.section_id)]) {
      console.log(
        `WorkspaceUsers: Users for section ${params.section_id} already in state. Returning.`
      );
      return state.usersBySection[String(params.section_id)]; // Trả về từ state riêng
    }

    // Nếu không có params và danh sách chung đã có
    if (!Object.keys(params).length && state.userList.length > 0) {
      console.log(
        "fetchUsers: No fetch needed (general user list). Returning."
      );
      return state.userList; // Trả về danh sách chung
    }

    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      console.log("Calling API: GET /employees with params:", params);
      // API cần hỗ trợ lọc theo params (ví dụ: ?section_id=...)
      const response = await apiClient.get("/employees", { params });
      const fetchedUsers = response.data?.data || response.data || [];
      console.log("API Response for users:", response.data);

      if (!Object.keys(params).length) {
        // Nếu không có params, lưu vào danh sách chung
        console.log("Committing SET_USERS (no params).");
        commit("SET_USERS", fetchedUsers);
      } else if (hasSectionIdParam) {
        // Nếu có section_id param, lưu vào state riêng usersBySection
        console.log(
          `Committing SET_USERS_BY_SECTION for section ${params.section_id}.`
        );
        commit("SET_USERS_BY_SECTION", {
          sectionId: params.section_id,
          users: fetchedUsers,
        });
      }
      // Thêm các case khác nếu API hỗ trợ lọc theo department_id hoặc các params khác

      return fetchedUsers; // Trả về dữ liệu fetch được
    } catch (error) {
      console.error("Error fetching users:", error.response || error);
      commit("SET_ERROR", error);
      // Clear state phù hợp khi lỗi
      if (!Object.keys(params).length) {
        commit("SET_USERS", []);
      } else if (hasSectionIdParam) {
        commit("SET_USERS_BY_SECTION", {
          sectionId: params.section_id,
          users: [],
        });
      }
      throw error; // Rethrow error
    } finally {
      commit("SET_LOADING", false);
    }
  },

  // Action riêng để fetch user theo Section ID, gọi lại action fetchUsers
  async fetchUsersBySection({ dispatch, state }, sectionId) {
    if (!sectionId) {
      console.warn("fetchUsersBySection: sectionId is required.");
      return Promise.resolve([]);
    }

    // Kiểm tra xem dữ liệu đã có trong state riêng chưa
    if (state.usersBySection[String(sectionId)]) {
      console.log(
        `WorkspaceUsersBySection: Users for section ${sectionId} already in state.`
      );
      return Promise.resolve(state.usersBySection[String(sectionId)]); // Trả về từ state
    }

    console.log(
      `WorkspaceUsersBySection: Fetching users for section ${sectionId}.`
    );
    // Gọi action fetchUsers với params section_id
    return dispatch("fetchUsers", { params: { section_id: sectionId } });
  },

  // Có thể thêm các actions khác như fetchUserById, createUser, updateUser, v.v.
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
