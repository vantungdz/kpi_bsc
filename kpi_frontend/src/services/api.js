import axios from "axios";
import store from "../store"; // Import store để lấy token và dispatch logout
import router from "../router"; // Import router để điều hướng

const apiClient = axios.create({
  baseURL: process.env.VUE_APP_API_URL || "/api",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Thêm token vào header
apiClient.interceptors.request.use(
  (config) => {
    const token = store.getters["auth/token"];
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('API call error:', error);
    return Promise.reject(error);
  }
);

// Response Interceptor: Xử lý lỗi chung, đặc biệt là 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response, // Trả về response nếu thành công
  (error) => {
    console.error("API Error:", error.response || error.message);

    if (error.response) {
      const status = error.response.status;

      if (status === 401) {
        // Nếu lỗi 401 (chưa đăng nhập hoặc token hết hạn)
        console.error("Unauthorized or Token Expired. Logging out...");
        // Gọi action logout để xóa token và thông tin user
        store.dispatch("auth/logout").then(() => {
          // Điều hướng về trang login sau khi logout
          if (router.currentRoute.value.name !== "Login") {
            router.push({ name: "Login", query: { sessionExpired: "true" } });
          }
        });
      } else if (status === 403) {
        // Lỗi không có quyền truy cập
        console.error("Forbidden access.");
        // Có thể hiển thị thông báo lỗi chung hoặc điều hướng đến trang lỗi
        alert("Bạn không có quyền thực hiện hành động này.");
      } else {
        // Các lỗi khác (400, 404, 500...)
        // Có thể hiển thị thông báo lỗi chung từ server nếu có
        // alert(error.response.data.message || 'Đã có lỗi xảy ra.');
      }
    } else if (error.request) {
      // Lỗi không nhận được phản hồi từ server
      console.error("No response received:", error.request);
      alert("Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng.");
    } else {
      // Lỗi khác khi thiết lập request
      console.error("Error setting up request:", error.message);
    }

    return Promise.reject(error); // Ném lỗi ra để các hàm gọi API có thể bắt (catch)
  }
);

export default apiClient;
