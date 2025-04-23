// src/store/modules/kpiValues.js
import apiClient from '../../services/api'; // Đảm bảo đường dẫn này chính xác
import { notification } from 'ant-design-vue';

export default {
  // **QUAN TRỌNG:** Module này phải được đăng ký với key là 'kpi-values' trong store/index.js
  namespaced: true,

  // State, Getters, Mutations không cần thiết cho module này nếu nó CHỈ dùng để gọi API update.
  // Dữ liệu (kpiDetail.values) nên được quản lý bởi module 'kpis'.
  // state: {},
  // getters: {},
  // mutations: {},

  actions: {
    /**
     * Action để cập nhật một bản ghi KpiValue hiện có.
     * @param {Object} context - Vuex action context (không dùng nên đặt là _)
     * @param {Object} payload - Dữ liệu cần thiết để cập nhật.
     * @param {number} payload.kpiValueId - ID của bản ghi KpiValue cần cập nhật.
     * @param {Object} payload.updateData - Object chứa các trường cần cập nhật (vd: { value, timestamp, notes }).
     * @returns {Promise<boolean>} - Trả về true nếu thành công, false nếu thất bại.
     */
    async updateKpiValue(_, { kpiValueId, updateData }) {
      // Kiểm tra đầu vào cơ bản
      if (!kpiValueId || !updateData) {
        console.error('[kpi-values/updateKpiValue] Missing kpiValueId or updateData.');
        notification.error({ message: 'Update Failed', description: 'Missing required data to update progress.' });
        return false;
      }

      console.log(`[Vuex kpi-values] Action updateKpiValue called for ID: ${kpiValueId}`); // Log khi action được gọi

      try {
        const apiUrl = `/kpi-values/${kpiValueId}`;
        console.log(`[Vuex kpi-values] Calling PATCH ${apiUrl} with data:`, updateData); // Log API call

        // Gọi API bằng apiClient đã cấu hình
        await apiClient.patch(apiUrl, updateData);

        console.log(`[Vuex kpi-values] PATCH call successful for ID: ${kpiValueId}`); // Log thành công
        notification.success({ message: 'Progress updated successfully!' }); // Thông báo thành công

        // **LƯU Ý:** Action này KHÔNG trực tiếp thay đổi state ở đây.
        // Component sau khi gọi action này và nhận kết quả 'true'
        // sẽ cần gọi action khác (ví dụ: 'kpis/fetchKpiDetail') để load lại dữ liệu mới nhất.
        return true; // Trả về true báo hiệu thành công

      } catch (error) {
        // Xử lý lỗi chi tiết hơn
        const status = error.response?.status;
        const serverMessage = error.response?.data?.message;
        let errorMessage = 'Failed to update progress.';

        if (status === 404) {
          errorMessage = `KPI Value record with ID ${kpiValueId} not found.`;
        } else if (serverMessage) {
          errorMessage = Array.isArray(serverMessage) ? serverMessage.join(', ') : serverMessage;
        } else {
          errorMessage = error.message || 'An unknown error occurred.';
        }

        console.error(`[Vuex kpi-values] Failed to update KPI Value ID ${kpiValueId}:`, error.response || error); // Log lỗi
        notification.error({ message: 'Update Failed', description: errorMessage }); // Thông báo lỗi chi tiết

        return false; // Trả về false báo hiệu thất bại
      }
    },

    // --- Action Thêm mới (Ví dụ nếu bạn cần) ---
    /**
     * Action để thêm một bản ghi KpiValue mới.
     * @param {Object} context - Vuex action context
     * @param {Object} payload - Dữ liệu cần thiết để tạo.
     * @param {number} payload.kpiId - ID của KPI cha mà giá trị này thuộc về.
     * @param {Object} payload.valueData - Object chứa dữ liệu của giá trị mới (vd: { value, timestamp, notes }).
     * @returns {Promise<boolean>} - True nếu thành công, false nếu thất bại.
     */
    /*
    async addKpiValue(_, { kpiId, valueData }) {
        if (!kpiId || !valueData) {
            console.error('[kpi-values/addKpiValue] Missing kpiId or valueData.');
            notification.error({ message: 'Add Failed', description: 'Missing required data to add progress.' });
            return false;
        }

        console.log(`[Vuex kpi-values] Action addKpiValue called for KPI ID: ${kpiId}`);

        try {
            // Backend cần biết giá trị này thuộc về KPI nào.
            // Backend cũng nên tự lấy user_id từ token.
            const payloadToSend = {
                ...valueData,
                kpi: { id: kpiId }, // Gửi kèm ID của KPI cha
            };
            const apiUrl = '/kpi-values';
            console.log(`[Vuex kpi-values] Calling POST ${apiUrl} with data:`, payloadToSend);

            await apiClient.post(apiUrl, payloadToSend);

            console.log(`[Vuex kpi-values] POST call successful for KPI ID: ${kpiId}`);
            notification.success({ message: 'Progress added successfully!' });
            // Component sẽ cần load lại kpiDetail sau khi thêm thành công
            return true;

        } catch (error) {
            const status = error.response?.status;
            const serverMessage = error.response?.data?.message;
            let errorMessage = 'Failed to add progress.';

            if (serverMessage) {
                 errorMessage = Array.isArray(serverMessage) ? serverMessage.join(', ') : serverMessage;
            } else {
                 errorMessage = error.message || 'An unknown error occurred.';
            }
            console.error(`[Vuex kpi-values] Failed to add KPI Value for KPI ID ${kpiId}:`, error.response || error);
            notification.error({ message: 'Add Failed', description: errorMessage });
            return false;
        }
    }
    */

  }, // Kết thúc actions
}; // Kết thúc export default