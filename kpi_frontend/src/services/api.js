import axios from 'axios';

// Tạo một instance của axios để cấu hình URL gốc và các header mặc định
const apiClient = axios.create({
  baseURL: 'http://localhost:3000', // Địa chỉ gốc của API
  headers: {
    'Content-Type': 'application/json', // Đảm bảo gửi dữ liệu dạng JSON
    // Nếu cần, bạn có thể thêm token hoặc các header khác tại đây
    // 'Authorization': `Bearer ${token}`
  },
});

// Bạn có thể thêm các interceptor nếu cần (ví dụ: xử lý lỗi toàn cục, token hết hạn, v.v.)
apiClient.interceptors.response.use(
  (response) => response, // Nếu không có lỗi, trả về response
  (error) => {
    // Xử lý lỗi toàn cục tại đây (như lỗi kết nối, API trả về lỗi)
    console.error('API call error:', error);
    return Promise.reject(error); // Trả về lỗi để các component xử lý
  }
);

export default apiClient;
