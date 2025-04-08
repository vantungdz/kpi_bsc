import apiClient from "../../services/api";

const state = {
  departments: [], // Danh sách department cho select/dropdown
  loading: false,
  error: null,
};

const getters = {
  departmentList: (state) => state.departments,
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
  SET_DEPARTMENTS(state, departments) {
    state.departments = departments;
  },
};

const actions = {
  async fetchDepartments({ commit }, params = {}) {
    // Nhận params để lọc nếu cần
    // Tránh fetch lại nếu đã có dữ liệu và không có filter đặc biệt
    // if (state.departments.length > 0 && !Object.keys(params).length) return;

    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      // Gọi API lấy danh sách department (có thể chỉ cần id, departmentname, first_name, last_name)
      // API cần hỗ trợ lọc theo role, department,... nếu component UserSelect yêu cầu
      const response = await apiClient.get("/departments", { params });
      commit("SET_DEPARTMENTS", response.data); // Giả sử API trả về { data: [...] } hoặc [...]
    } catch (error) {
      commit("SET_ERROR", error);
      commit("SET_DEPARTMENTS", []); // Set rỗng nếu lỗi
    } finally {
      commit("SET_LOADING", false);
    }
  },
  // Thêm các actions CRUD department nếu cần (thường cho Admin)
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
