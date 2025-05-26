import apiClient from "@/core/services/api";
import router from "@/core/router";

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
};

const getters = {
  isAuthenticated: (state) => !!state.token,
  authStatus: (state) => state.status,
  user: (state) => state.user,
  token: (state) => state.token,
  // Chuẩn hóa: trả về user.role?.name (role entity)
  effectiveRole: (state) => state.user?.role?.name || null,
  authError: (state) => state.error,
  // Chuẩn hóa: trả về mảng roles (string hoặc object)
  userRoles: (state) => {
    const user = state.user;
    if (!user) return [];
    if (Array.isArray(user.roles)) {
      return user.roles
        .map((r) => (typeof r === "string" ? r : r?.name))
        .filter(Boolean);
    }
    if (user.role) {
      if (typeof user.role === "string") return [user.role];
      if (typeof user.role === "object" && user.role?.name)
        return [user.role.name];
    }
    return [];
  },
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
    const storage = remember ? localStorage : sessionStorage;
    const otherStorage = remember ? sessionStorage : localStorage;
    otherStorage.removeItem("authToken");
    otherStorage.removeItem("authUser");
    storage.setItem("authToken", token);
    if (user) {
      storage.setItem("authUser", JSON.stringify(user));
    } else {
      storage.removeItem("authUser");
    }
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  },
  AUTH_ERROR(state, errorPayload) {
    state.status = "error";
    state.token = null;
    state.user = null;
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authUser");
    delete apiClient.defaults.headers.common["Authorization"];
    const specificMessage =
      errorPayload?.response?.data?.message ||
      errorPayload?.message ||
      "Login failed. Please check your credentials or try again later.";
    state.error = specificMessage;
  },
  LOGOUT(state) {
    state.status = "";
    state.token = null;
    state.user = null;
    state.error = null;
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authUser");
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

      localStorage.setItem("authToken", token);
      apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      let user = null;
      try {
        user = await dispatch("fetchUserProfileInternal");
        if (!user) throw new Error("Profile fetch failed.");
      } catch (profileError) {
        commit("LOGOUT");
        commit("AUTH_ERROR", profileError);
        return false;
      }

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
};

const initialToken =
  localStorage.getItem("authToken") || sessionStorage.getItem("authToken");
if (initialToken) {
  apiClient.defaults.headers.common["Authorization"] = `Bearer ${initialToken}`;
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
