import apiClient from "../../services/api";
import router from "../../router";

const state = {
  token:
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken") ||
    null,
  user:
    JSON.parse(
      localStorage.getItem("authUser") || sessionStorage.getItem("authUser")
    ) || null,
  status: "",
  error: null,
  effectiveRole:
    localStorage.getItem("authEffectiveRole") ||
    sessionStorage.getItem("authEffectiveRole") ||
    null,
};

const getters = {
  isAuthenticated: (state) => !!state.token,
  authStatus: (state) => state.status,
  user: (state) => state.user,
  token: (state) => state.token,
  actualUserRole: (state) => state.user?.role,
  effectiveRole: (state) => state.effectiveRole || state.user?.role || null,
  authError: (state) => state.error,
};

const mutations = {
  AUTH_REQUEST(state) {
    state.status = "loading";
    state.error = null;
  },
  AUTH_SUCCESS(state, { token, user, remember }) {
    state.status = "success";
    state.token = token;
    state.user = user;
    state.error = null;
    state.effectiveRole = user?.role || null;
    const storage = remember ? localStorage : sessionStorage;
    const otherStorage = remember ? sessionStorage : localStorage;
    otherStorage.removeItem("authToken");
    otherStorage.removeItem("authUser");
    otherStorage.removeItem("authEffectiveRole");
    storage.setItem("authToken", token);
    if (user) {
      storage.setItem("authUser", JSON.stringify(user));
    } else {
      storage.removeItem("authUser");
    }
    if (state.effectiveRole) {
      storage.setItem("authEffectiveRole", state.effectiveRole);
    } else {
      storage.removeItem("authEffectiveRole");
    }
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  },
  AUTH_ERROR(state, errorPayload) {
    state.status = "error";
    state.token = null;
    state.user = null;
    state.effectiveRole = null;
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    localStorage.removeItem("authEffectiveRole");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authUser");
    sessionStorage.removeItem("authEffectiveRole");
    delete apiClient.defaults.headers.common["Authorization"];
    let errorMessage = "Login failed...";
    /* Xử lý lỗi */ state.error = errorMessage;
    console.error("Auth Error:", errorPayload);
  },
  LOGOUT(state) {
    state.status = "";
    state.token = null;
    state.user = null;
    state.error = null;
    state.effectiveRole = null;
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    localStorage.removeItem("authEffectiveRole");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authUser");
    sessionStorage.removeItem("authEffectiveRole");
    delete apiClient.defaults.headers.common["Authorization"];
  },
  SET_USER(state, user) {
    state.user = user;
    const tokenInLocal = localStorage.getItem("authToken");
    const storage = tokenInLocal ? localStorage : sessionStorage;
    if (user) {
      storage.setItem("authUser", JSON.stringify(user));
    } else {
      storage.removeItem("authUser");
    }
    const currentSimulatedRole = storage.getItem("authEffectiveRole");
    if (!currentSimulatedRole && user) {
      state.effectiveRole = user.role || null;
      storage.setItem("authEffectiveRole", state.effectiveRole);
    }
  },
  SET_EFFECTIVE_ROLE(state, role) {
    const newRole = role || state.user?.role || null;
    state.effectiveRole = newRole;
    const tokenInLocal = localStorage.getItem("authToken");
    const storage = tokenInLocal ? localStorage : sessionStorage;
    if (newRole) {
      storage.setItem("authEffectiveRole", newRole);
    } else {
      storage.removeItem("authEffectiveRole");
    }
    console.log("Effective role set to:", newRole);
  },
};

const actions = {

  async login({ commit, dispatch }, credentials) {
    commit("AUTH_REQUEST");
    try {
      const apiPayload = {
        username: credentials.username,
        password: credentials.password,
      };
      const response = await apiClient.post("/auth/login", apiPayload);
      const token = response.data.access_token;
      if (!token) throw new Error("Token not received.");

      // Lưu token vào localStorage hoặc sessionStorage
      localStorage.setItem("authToken", token);
      apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // Lấy thông tin người dùng từ API /profile
      let user = null;
      try {
        user = await dispatch("fetchUserProfileInternal");
        if (!user) throw new Error("Profile fetch failed.");
      } catch (profileError) {
        commit("LOGOUT");
        commit("AUTH_ERROR", profileError);
        return false;
      }

      // Cập nhật thành công
      commit("AUTH_SUCCESS", { token, user, remember: credentials.remember });
      return true;
    } catch (error) {
      if (!state.error) {
        commit("AUTH_ERROR", error);
      }
      return false;
    }
  },

  logout({ commit }) {
    commit("LOGOUT");
    const loginRouteName = "LoginPage";
    if (router.currentRoute.value.name !== loginRouteName) {
      router.push({ name: loginRouteName });
    }
  },
  async fetchUserProfileInternal({ commit }) {
    try {
      const response = await apiClient.get("/auth/profile");
      commit("SET_USER", response.data?.data || response.data);
      return response.data?.data || response.data;
    } catch (error) {
      console.error("Failed fetchUserProfileInternal:", error);
      throw error;
    }
  },

  async fetchUserProfile({ dispatch }) {
    try {
      await dispatch("fetchUserProfileInternal");
    } catch (error) {
      dispatch("logout");
    }
  },
  changeEffectiveRole({ commit }, role) {
    commit("SET_EFFECTIVE_ROLE", role); 
  },

};

const initialToken =
  localStorage.getItem("authToken") || sessionStorage.getItem("authToken");
if (initialToken) {
  apiClient.defaults.headers.common["Authorization"] = `Bearer ${initialToken}`;
  const initialEffectiveRole =
    localStorage.getItem("authEffectiveRole") ||
    sessionStorage.getItem("authEffectiveRole");
  const storedUser = JSON.parse(
    localStorage.getItem("authUser") || sessionStorage.getItem("authUser")
  );
  state.effectiveRole = initialEffectiveRole || storedUser?.role || null;
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
