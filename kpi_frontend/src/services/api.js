import axios from "axios";
import store from "../store"; // Import store để lấy token và dispatch logout
import router from "../router"; // Import router để điều hướng
import { notification } from 'ant-design-vue';
const apiClient = axios.create({
  baseURL: process.env.VUE_APP_API_URL || "/api", // Đảm bảo biến môi trường được cấu hình đúng
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Thêm token vào header
apiClient.interceptors.request.use(
  (config) => {
    // Lấy token từ store thay vì localStorage trực tiếp để đảm bảo tính nhất quán
    const token = store.getters["auth/token"];
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error("API Request Setup Error:", error); // Log lỗi rõ hơn
    return Promise.reject(error);
  }
);

// Response Interceptor: Xử lý lỗi chung, đặc biệt là 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response, // Trả về response nếu thành công
  (error) => {
    console.error("API Response Error:", error.response || error.message);

    if (error.response) {
      const status = error.response.status;
      const currentRouteName = router.currentRoute.value.name; // Lấy tên route hiện tại
      const loginRouteName = 'LoginPage'; // <<<=== ĐỊNH NGHĨA TÊN ROUTE LOGIN ĐÚNG Ở ĐÂY

      if (status === 401) {
        // Nếu lỗi 401 (chưa đăng nhập hoặc token hết hạn)
        // Chỉ thực hiện logout và điều hướng nếu chưa ở trang Login
        if (currentRouteName !== loginRouteName) {
             console.error("Unauthorized (401) or Token Expired. Logging out and redirecting...");
            // Gọi action logout để xóa token và thông tin user
            // store.dispatch("auth/logout"); // Action logout đã tự điều hướng rồi, không cần .then() phức tạp ở đây nữa

            // Thay vì gọi logout trực tiếp trong interceptor (có thể gây vòng lặp),
            // chỉ cần điều hướng, và router guard sẽ xử lý tiếp nếu cần.
            // Hoặc commit trực tiếp nếu cần thiết và đảm bảo không có vòng lặp
             store.commit('auth/LOGOUT'); // Gọi mutation trực tiếp để xóa state/storage
             router.push({ name: loginRouteName, query: { sessionExpired: "true" } }); // <<<=== SỬ DỤNG TÊN ROUTE ĐÚNG

        } else {
            console.warn("Already on Login page, received 401.");
            // Nếu đang ở trang Login mà vẫn bị 401 (ví dụ: submit sai),
            // thì không cần điều hướng lại, action login sẽ xử lý lỗi và hiển thị.
        }

      } else if (status === 403) {
        // Lỗi không có quyền truy cập
        console.error("Forbidden (403). Access denied.");
        // Hiển thị thông báo lỗi chung
        notification.error({ // Dùng notification cho nhất quán
             message: 'Access Denied',
             description: 'You do not have permission to perform this action or access this resource.',
         });
        // Có thể điều hướng về trang chủ hoặc trang lỗi tùy chỉnh
        // router.push({ name: 'Dashboard' }); // Ví dụ về trang chủ
      } else {
        // Các lỗi khác (400, 404, 500...)
        // Action gọi API nên tự bắt lỗi và commit vào store.error nếu cần hiển thị trên UI
        // Interceptor chủ yếu xử lý lỗi chung như 401, 403, lỗi mạng.
        console.error(`API Error ${status}:`, error.response.data);
      }
    } else if (error.request) {
      // Lỗi không nhận được phản hồi từ server (lỗi mạng)
      console.error("Network Error:", error.request);
      notification.error({
          message: 'Network Error',
          description: 'Unable to connect to the server. Please check your network connection.',
          duration: 5 // Hiển thị lâu hơn
      });
    } else {
      // Lỗi khác khi thiết lập request
      console.error("Request Setup Error:", error.message);
       notification.error({
          message: 'Request Error',
          description: 'An error occurred while setting up the request.',
       });
    }

    // Vẫn reject promise để các hàm gọi API gốc có thể bắt lỗi nếu cần xử lý thêm
    return Promise.reject(error);
  }
);

export default apiClient;