// store/modules/sections.js
import apiClient from "../../services/api";

const state = {
  sections: [], // Danh sách sections chung (có thể không cần thiết nếu luôn fetch theo department)
  loading: false,
  error: null, // Kích hoạt state riêng cho sections đã lọc theo department
  sectionsByDepartment: {},
};

const getters = {
  sectionList: (state) => state.sections, // Getter cho danh sách chung (có thể không cần dùng)
  isLoading: (state) => state.loading,
  error: (state) => state.error, // Getter để truy cập sections đã lọc theo department từ state riêng
  sectionsByDepartment: (state) => (departmentId) =>
    state.sectionsByDepartment[departmentId] || [],
};

const mutations = {
  SET_LOADING(state, isLoading) {
    state.loading = isLoading;
  },
  SET_ERROR(state, error) {
    state.error = error ? error.response?.data?.message || error.message : null;
  },
  SET_SECTIONS(state, sectionsData) {
    console.log("MUTATION SET_SECTIONS called with data:", sectionsData); // LOG MUTATION
    state.sections = sectionsData?.data || sectionsData || [];
  }, // Kích hoạt mutation để lưu sections đã lọc theo department
  SET_SECTIONS_BY_DEPARTMENT(state, { departmentId, sections }) {
    // Đảm bảo departmentId là string hoặc number nhất quán khi dùng làm key
    const key = String(departmentId);
    state.sectionsByDepartment = {
      ...state.sectionsByDepartment,
      [key]: sections?.data || sections || [], // Lưu dữ liệu vào key departmentId
    };
    console.log(
      `MUTATION SET_SECTIONS_BY_DEPARTMENT called for department ${departmentId}. State updated.`
    ); // LOG MUTATION
  },
};

const actions = {
  // Action fetch sections chung HOẶC theo params. Có thể không cần nếu luôn fetch theo department.
  // Tạm thời giữ nguyên nhưng lưu ý logic không commit vào state chung nếu có department_id param.
  async fetchSections(
    { commit, state },
    { params = {}, forceRefresh = false } = {}
  ) {
    // Check if params includes department_id specifically for conditional logic
    const hasDepartmentIdParam =
      typeof params.department_id !== "undefined" &&
      params.department_id !== null &&
      params.department_id !== ""; // Nếu có filter department và dữ liệu đã có trong state riêng (và không forceRefresh)

    if (
      hasDepartmentIdParam &&
      state.sectionsByDepartment[String(params.department_id)] &&
      !forceRefresh
    ) {
      console.log(
        `WorkspaceSections: Sections for department ${params.department_id} already in state. Returning.`
      );
      return state.sectionsByDepartment[String(params.department_id)]; // Trả về từ state riêng
    }

    // Nếu không có department_id param và dữ liệu chung đã có
    if (!hasDepartmentIdParam && state.sections.length > 0 && !forceRefresh) {
      console.log(
        "fetchSections: No fetch needed (general sections). Returning."
      );
      return state.sections; // Trả về dữ liệu chung
    }

    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      console.log("Calling API: GET /sections with params:", params); // LOG API CALL
      const response = await apiClient.get("/sections", { params });
      const fetchedSections = response.data?.data || response.data || [];
      console.log("API Response for sections:", response.data); // LOG API RESPONSE
      // Lưu dữ liệu vào state chung CHỈ KHI KHÔNG CÓ FILTER DEPARTMENT

      if (!hasDepartmentIdParam) {
        console.log("Committing SET_SECTIONS (no department_id param).");
        commit("SET_SECTIONS", fetchedSections);
      } else {
        // Nếu có filter department, lưu vào state riêng sectionsByDepartment
        console.log(
          `Committing SET_SECTIONS_BY_DEPARTMENT for department ${params.department_id}.`
        );
        commit("SET_SECTIONS_BY_DEPARTMENT", {
          departmentId: params.department_id,
          sections: fetchedSections,
        });
      }

      return fetchedSections; // Trả về dữ liệu fetch được
    } catch (error) {
      console.error("Error fetching sections:", error.response || error); // LOG ERROR
      commit("SET_ERROR", error); // Nếu fetch chung lỗi, set state chung về rỗng
      if (!hasDepartmentIdParam) {
        commit("SET_SECTIONS", []);
      } // Nếu fetch theo department lỗi, clear state riêng cho department đó
      if (hasDepartmentIdParam) {
        commit("SET_SECTIONS_BY_DEPARTMENT", {
          departmentId: params.department_id,
          sections: [],
        });
      }
      throw error; // Rethrow error để component có thể catch
    } finally {
      commit("SET_LOADING", false);
    }
  }, // Action fetch sections theo department ID - Đã chỉnh sửa để sử dụng action fetchSections
  // và đảm bảo dữ liệu được lưu vào state riêng.

  async fetchSectionsByDepartment({ dispatch, state }, departmentId) {
    // Giữ dispatch và state
    if (!departmentId) {
      console.warn("fetchSectionsByDepartment: departmentId is required.");
      // Có thể set lỗi hoặc trả về Promise.resolve/reject
      return Promise.resolve([]); // Trả về mảng rỗng nếu không có ID
    }

    // Kiểm tra xem dữ liệu đã có trong state riêng chưa
    if (state.sectionsByDepartment[String(departmentId)]) {
      console.log(
        `WorkspaceSectionsByDepartment: Sections for department ${departmentId} already in state.`
      );
      return Promise.resolve(state.sectionsByDepartment[String(departmentId)]); // Trả về từ state
    }

    console.log(
      `WorkspaceSectionsByDepartment: Fetching sections for department ${departmentId}.`
    ); // Sử dụng action fetchSections với params department_id, action này sẽ lo việc loading/error/commit
    return dispatch("fetchSections", {
      params: { department_id: departmentId },
    });
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
