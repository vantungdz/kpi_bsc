import apiClient from "@/core/services/api";
import { getTranslatedErrorMessage } from "@/core/services/messageTranslator";

// ==================== STATE ====================
const state = {
  // Danh sách chính
  items: [],

  // Chi tiết item
  itemDetail: null,

  // Loading states
  loading: false,
  loadingDetail: false,

  // Error states
  error: null,
  detailError: null,
};

// ==================== GETTERS ====================
const getters = {
  // Danh sách items
  list: (state) => state.items,

  // Chi tiết item
  detail: (state) => state.itemDetail,

  // Loading states
  isLoading: (state) => state.loading,

  // Error states
  error: (state) => state.error,
};

// ==================== MUTATIONS ====================
const mutations = {
  // Set loading
  SET_LOADING(state, loading) {
    state.loading = loading;
  },

  // Set errors
  SET_ERROR(state, error) {
    state.error = error
      ? getTranslatedErrorMessage(error.response?.data?.message) ||
        error.message
      : null;
  },

  // Set loading detail
  SET_LOADING_DETAIL(state, loading) {
    state.loadingDetail = loading;
  },

  // Set data
  SET_ITEMS(state, items) {
    state.items = items || [];
  },

  SET_ITEM_DETAIL(state, detail) {
    state.itemDetail = detail;
  },

  // Add item to list
  ADD_ITEM(state, item) {
    state.items.push(item);
  },

  // Update item in list
  UPDATE_ITEM(state, updatedItem) {
    const index = state.items.findIndex((item) => item.id === updatedItem.id);
    if (index !== -1) {
      state.items.splice(index, 1, updatedItem);
    }
  },

  // Remove item from list
  REMOVE_ITEM(state, id) {
    state.items = state.items.filter((item) => item.id !== id);
  },

  // Reset state
  RESET_STATE(state) {
    state.itemDetail = null;
    state.error = null;
    state.detailError = null;
    state.loading = false;
    state.loadingDetail = false;
  },
};

const actions = {
  /**
   * Lấy danh sách items
   * @param {Object} context - Vuex context
   * @param {Object} params - Query parameters (filters, pagination, etc.)
   */
  async fetchItems({ commit }, params = {}) {
    commit("SET_LOADING", true);
    commit("SET_ERROR", null);
    try {
      const response = await apiClient.get("/template", { params });

      // Xử lý response với nhiều trường hợp
      let items = [];
      
      // Trường hợp 1: API trả về { data: [...], pagination: {...} }
      if (response.data?.data && Array.isArray(response.data.data)) {
        items = response.data.data;
      } 
      // Trường hợp 2: API trả về array trực tiếp
      else if (Array.isArray(response.data)) {
        items = response.data;
      }
      // Trường hợp 3: Response có cấu trúc khác
      else if (response.data && typeof response.data === 'object') {
        // Thử lấy từ các key có thể có
        items = response.data.items || response.data.results || [];
      }

      commit("SET_ITEMS", items);
      return response.data;
    } catch (error) {
      console.error("Error fetching templates:", error);
      commit("SET_ERROR", error);
      commit("SET_ITEMS", []);
      throw error;
    } finally {
      commit("SET_LOADING", false);
    }
  },

  /**
   * Lấy chi tiết item theo ID
   * @param {Object} context - Vuex context
   * @param {Number|String} id - Item ID
   */
  async fetchItemById({ commit, dispatch }, id) {
    if (!id) {
      return null;
    }

    await dispatch("loading/startLoading", null, { root: true });
    commit("SET_LOADING_DETAIL", true);

    try {
      const response = await apiClient.get(`/template/${id}`);
      commit("SET_ITEM_DETAIL", response.data);
      return response.data;
    // eslint-disable-next-line no-useless-catch
    } catch (error) {
      throw error;
    } finally {
      commit("SET_LOADING_DETAIL", false);
      await dispatch("loading/stopLoading", null, { root: true });
    }
  },

  /**
   * Tạo mới item
   * @param {Object} context - Vuex context
   * @param {Object} payload - Data để tạo item
   */
  async createItem({ dispatch, commit }, payload) {
    await dispatch("loading/startLoading", null, { root: true });
    commit("SET_ERROR", null);

    try {
      const response = await apiClient.post("/template/create", payload);

      // Refresh danh sách sau khi tạo
      await dispatch("fetchItems", { forceRefresh: true });

      return response.data;
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      await dispatch("loading/stopLoading", null, { root: true });
    }
  },

  /**
   * Cập nhật item
   * @param {Object} context - Vuex context
   * @param {Object} payload - { id, data }
   */
  async updateItem({ dispatch, commit }, { id, data }) {
    await dispatch("loading/startLoading", null, { root: true });
    commit("SET_ERROR", null);

    try {
      const response = await apiClient.put(`/template/${id}`, data);

      // Update item trong list
      commit("UPDATE_ITEM", response.data);

      // Refresh danh sách nếu cần
      // await dispatch("fetchItems", { forceRefresh: true });

      return response.data;
    } catch (error) {
      commit("SET_ERROR", error);
      throw error;
    } finally {
      await dispatch("loading/stopLoading", null, { root: true });
    }
  },

  /**
   * Xóa item
   * @param {Object} context - Vuex context
   * @param {Number|String} id - Item ID
   */
  async deleteItem({ dispatch, commit }, id) {
    await dispatch("loading/startLoading", null, { root: true });
    commit("SET_ERROR", null);

    try {
      await apiClient.delete(`/template/${id}`);

      // Remove item khỏi list
      commit("REMOVE_ITEM", id);

      // Hoặc refresh danh sách
      // await dispatch("fetchItems", { forceRefresh: true });

      return true;
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error.message ||
        "Failed to delete item";
      commit("SET_ERROR", msg);
      throw new Error(msg);
    } finally {
      await dispatch("loading/stopLoading", null, { root: true });
    }
  },

  /**
   * Reset state về trạng thái ban đầu
   */
  resetState({ commit }) {
    commit("RESET_STATE");
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
