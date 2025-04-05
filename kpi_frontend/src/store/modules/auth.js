import apiClient from '../../services/api';
import router from '../../router'; // Import router để điều hướng

const state = {
  token: localStorage.getItem('authToken') || null,
  user: JSON.parse(localStorage.getItem('authUser')) || null,
  status: '', // 'loading', 'success', 'error'
};

const getters = {
  isAuthenticated: (state) => !!state.token,
  authStatus: (state) => state.status,
  user: (state) => state.user,
  token: (state) => state.token,
  userRole: (state) => state.user?.role, // Cần có trường 'role' trong user object
};

const mutations = {
  AUTH_REQUEST(state) {
    state.status = 'loading';
    state.error = null; // Reset error
  },
  AUTH_SUCCESS(state, { token, user }) {
    state.status = 'success';
    state.token = token;
    state.user = user;
    state.error = null;
    // Lưu vào localStorage
    localStorage.setItem('authToken', token);
    localStorage.setItem('authUser', JSON.stringify(user));
  },
  AUTH_ERROR(state, error) {
    state.status = 'error';
    state.token = null;
    state.user = null;
    // Xóa khỏi localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    // Lưu thông báo lỗi nếu có từ API
    state.error = error?.response?.data?.message || 'Đăng nhập thất bại.';
  },
  LOGOUT(state) {
    state.status = '';
    state.token = null;
    state.user = null;
    state.error = null;
    // Xóa khỏi localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
  },
  SET_USER(state, user) { // Mutation để cập nhật user nếu cần fetch lại profile
    state.user = user;
    localStorage.setItem('authUser', JSON.stringify(user));
  }
};

const actions = {
  async login({ commit }, credentials) {
    commit('AUTH_REQUEST');
    try {
      const response = await apiClient.post('/auth/login', credentials);
      const token = response.data.access_token;
      // Nên có một endpoint để lấy thông tin user sau khi login thành công
      // Ví dụ: const userResponse = await apiClient.get('/auth/profile');
      // const user = userResponse.data;
      // Tạm thời lấy user từ payload token nếu có, hoặc cần API /profile
      const user = response.data.user || { username: credentials.username, role: 'employee'}; // Cần API trả về user hoặc fetch riêng
      commit('AUTH_SUCCESS', { token, user });
      return true; // Trả về true nếu thành công
    } catch (error) {
      commit('AUTH_ERROR', error);
      return false; // Trả về false nếu thất bại
    }
  },
  logout({ commit }) {
    commit('LOGOUT');
    // Không cần gọi API logout nếu dùng JWT thuần túy (token chỉ hết hạn)
    // Nếu có API logout phía backend (ví dụ: để blacklist token) thì gọi ở đây
    // await apiClient.post('/auth/logout');
    // Điều hướng về trang login sau khi logout
    if (router.currentRoute.value.name !== 'Login') {
         router.push({ name: 'Login' });
    }
  },
   // (Tùy chọn) Action để fetch lại thông tin user dựa trên token hiện tại
   async fetchUserProfile({ commit }) {
       const token = localStorage.getItem('authToken');
       if (!token) return; // Không làm gì nếu không có token
       try {
           const response = await apiClient.get('/auth/profile');
           commit('SET_USER', response.data);
       } catch (error) {
           console.error('Failed to fetch user profile:', error);
           // Có thể logout nếu fetch profile lỗi (ví dụ: token hết hạn nhưng chưa bị xóa)
           commit('LOGOUT');
           router.push({ name: 'Login' });
       }
   }
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};