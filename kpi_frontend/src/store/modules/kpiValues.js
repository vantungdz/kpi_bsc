import apiClient from '../../services/api';

const state = {
  // Thường không cần lưu danh sách values ở global store
  // vì nó thường được lấy kèm khi fetch chi tiết KPI
  loading: false, // Loading cho việc thêm mới
  error: null,
};

const getters = {
  isLoading: (state) => state.loading,
  error: (state) => state.error,
};

const mutations = {
  SET_LOADING(state, isLoading) { state.loading = isLoading; },
  SET_ERROR(state, error) { state.error = error ? (error.response?.data?.message || error.message) : null; },
};

const actions = {
  // Action chính là thêm một giá trị mới (Update Progress)
  async addKpiValue({ commit, rootGetters }, valueData) { // valueData = { kpiId, value, timestamp, notes }
    commit('SET_LOADING', true);
    commit('SET_ERROR', null);
    try {
        // Lấy userId của người đang đăng nhập từ store auth
        const userId = rootGetters['auth/userId'];
        if(!userId){
             throw new Error("User not authenticated to add KPI value.");
        }
        const payload = { ...valueData, userId };

      const response = await apiClient.post('/kpi-values', payload);
      // Không cần commit vào state ở đây vì KpiDetail sẽ fetch lại
      return response.data; // Trả về giá trị đã lưu
    } catch (error) {
      commit('SET_ERROR', error);
      throw error; // Ném lỗi ra để component xử lý
    } finally {
      commit('SET_LOADING', false);
    }
  },
  // Có thể thêm action fetchKpiValueHistory(kpiId) nếu API chi tiết KPI không trả về sẵn
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};