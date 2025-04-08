import apiClient from "../../services/api";

const state = {
  kpis: [], // Danh sách KPI cho trang list (có phân trang)
  kpisAllForSelect: [], // Danh sách KPI rút gọn cho dropdown Parent (không phân trang)
  currentKpi: null, // KPI đang xem chi tiết
  loading: false,
  loadingAll: false, // Loading riêng cho fetchAllKpisForSelect
  error: null,
  pagination: {
    currentPage: 1,
    totalPages: 5,
    totalItems: 50,
    itemsPerPage: 15,
  },
};

const getters = {
  kpiList: (state) => state.kpis,
  kpiListAll: (state) => state.kpisAllForSelect, // Getter cho dropdown parent
  currentKpi: (state) => state.currentKpi,
  isLoading: (state) => state.loading,
  error: (state) => state.error,
  pagination: (state) => state.pagination,
};

const mutations = {
  SET_LOADING(state, isLoading) {
    state.loading = isLoading;
  },
  SET_LOADING_ALL(state, isLoading) {
    state.loadingAll = isLoading;
  },
  SET_ERROR(state, error) {
    state.error = error ? error.response?.data?.message || error.message : null;
  },
  SET_KPIS(state, kpiData) {
    state.kpis = kpiData.data;
  },
  SET_KPIS_ALL_FOR_SELECT(state, kpis) {
    state.kpisAllForSelect = kpis;
  },
  SET_CURRENT_KPI(state, kpi) {
    state.currentKpi = kpi;
  },
  ADD_KPI(state, kpi) {
    // Thêm vào đầu danh sách hiện tại (có thể cần kiểm tra nếu nó thuộc trang hiện tại)
    state.kpis.unshift(kpi);
    state.pagination.totalItems++;
    // Thêm vào danh sách cho select box
    state.kpisAllForSelect.unshift({
      id: kpi.id,
      name: kpi.name,
      path: kpi.path,
    }); // Chỉ thêm field cần thiết
  },
  UPDATE_KPI(state, updatedKpi) {
    // Cập nhật trong danh sách chính
    const index = state.kpis.findIndex((k) => k.id === updatedKpi.id);
    if (index !== -1) state.kpis.splice(index, 1, updatedKpi);
    // Cập nhật trong danh sách select
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
      state.currentKpi = { ...state.currentKpi, ...updatedKpi }; // Merge để giữ relations đã load nếu có
    }
  },
  REMOVE_KPI(state, kpiId) {
    state.kpis = state.kpis.filter((k) => k.id !== kpiId);
    state.kpisAllForSelect = state.kpisAllForSelect.filter(
      (k) => k.id !== kpiId
    );
    state.pagination.totalItems--;
    if (state.currentKpi && state.currentKpi.id === kpiId) {
      state.currentKpi = null; // Xóa nếu đang xem chi tiết
    }
  },
};

const actions = {
  async fetchKpis({ commit }, params = {}) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.get("/kpis", { params });
      commit("SET_KPIS", response); // API cần trả về cấu trúc { data: [...], meta: {...} }
      // mutations.SET_KPIS("SET_KPIS", response);
    } catch (error) {
      commit("SET_ERROR", error);
    } finally {
      commit("SET_LOADING", false);
    }
  },
  // Action riêng để lấy danh sách rút gọn cho dropdown Parent KPI
  async fetchAllKpisForSelect({ commit, state }) {
    console.log("fetchAllKpisForSelect");
    // Chỉ fetch nếu chưa có hoặc cần refresh
    if (state.kpisAllForSelect.length > 0) return;

    commit("SET_LOADING_ALL", true);
    commit("SET_ERROR", null); // Có thể dùng error riêng
    try {
      // Gọi API lấy danh sách rút gọn (chỉ id, name, path, parentId - nếu cần lọc client)
      // Có thể cần phân trang nếu quá nhiều, hoặc backend lọc sẵn
      const response = await apiClient.get("/kpis", {
        params: { limit: 1000, fields: "id,name,path,parentId" },
      }); // Ví dụ lấy 1000 kpi
      console.log(response);
      commit("SET_KPIS_ALL_FOR_SELECT", response.data.data || response.data); // Lấy data tùy cấu trúc API trả về
    } catch (error) {
      commit("SET_ERROR", error); // Set lỗi chung hoặc lỗi riêng
    } finally {
      commit("SET_LOADING_ALL", false);
    }
  },
  async fetchKpi({ commit }, id) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    commit("SET_CURRENT_KPI", null);
    try {
      // API cần trả về đầy đủ thông tin, bao gồm relations (parent, perspective, assignedTo, updateHistory, evaluations...)
      const response = await apiClient.get(`/kpis/${id}`);
      commit("SET_CURRENT_KPI", response.data);
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },
  async createKpi({ commit }, kpiData) {
    commit("SET_LOADING", true); // Có thể dùng loading riêng cho submit
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.post("/kpis", kpiData);
      commit("ADD_KPI", response.data); // Thêm vào state
      // dispatch('fetchAllKpisForSelect'); // Cập nhật lại danh sách select parent (hoặc chỉ thêm vào)
      return response.data;
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },
  async updateKpi({ commit, dispatch }, { id, kpiData }) {
    console.log(dispatch);
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.patch(`/kpis/${id}`, kpiData);
      commit("UPDATE_KPI", response.data);
      // dispatch('fetchAllKpisForSelect'); // Cập nhật lại danh sách select parent (hoặc chỉ cập nhật)
      return response.data;
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },
  async deleteKpi({ commit, dispatch }, id) {
    console.log(dispatch);
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      await apiClient.delete(`/kpis/${id}`);
      commit("REMOVE_KPI", id);
      // dispatch('fetchAllKpisForSelect'); // Cập nhật lại danh sách select parent
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      commit("SET_LOADING", false);
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
