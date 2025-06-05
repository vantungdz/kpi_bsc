import apiClient from "@/core/services/api";
import { notification } from "ant-design-vue";

const state = {
  formulas: [],
  loading: false,
  error: null,
};

const getters = {
  getFormulas: (state) => state.formulas,
  getFormulaById: (state) => (id) => state.formulas.find((f) => f.id === id),
  isFormulaLoading: (state) => state.loading,
  getFormulaError: (state) => state.error,
};

const mutations = {
  SET_FORMULAS(state, formulas) {
    state.formulas = formulas || [];
  },
  SET_FORMULA_LOADING(state, loading) {
    state.loading = loading;
  },
  SET_FORMULA_ERROR(state, error) {
    state.error = error
      ? error.response?.data?.message ||
        error.message ||
        "Đã xảy ra lỗi khi thao tác công thức."
      : null;
  },
};

const actions = {
  async fetchFormulas({ commit }) {
    commit("SET_FORMULA_LOADING", true);
    commit("SET_FORMULA_ERROR", null);
    try {
      const res = await apiClient.get("/kpi-formulas");
      commit("SET_FORMULAS", res.data);
      return res.data;
    } catch (error) {
      commit("SET_FORMULA_ERROR", error);
      notification.error({
        message: "Lỗi tải công thức",
        description: error.message || "Không thể tải danh sách công thức.",
      });
      throw error;
    } finally {
      commit("SET_FORMULA_LOADING", false);
    }
  },

  async addFormula({ dispatch, commit }, formula) {
    commit("SET_FORMULA_LOADING", true);
    commit("SET_FORMULA_ERROR", null);
    try {
      await apiClient.post("/kpi-formulas", formula);
      notification.success({ message: "Thêm công thức thành công!" });
      await dispatch("fetchFormulas");
    } catch (error) {
      commit("SET_FORMULA_ERROR", error);
      notification.error({
        message: "Thêm công thức thất bại",
        description:
          error?.response?.data?.message ||
          error?.message ||
          "Không thể thêm công thức.",
      });
      throw error;
    } finally {
      commit("SET_FORMULA_LOADING", false);
    }
  },

  async updateFormula({ dispatch, commit }, { id, updateData }) {
    commit("SET_FORMULA_LOADING", true);
    commit("SET_FORMULA_ERROR", null);
    try {
      await apiClient.put(`/kpi-formulas/${id}`, updateData);
      notification.success({ message: "Cập nhật công thức thành công!" });
      await dispatch("fetchFormulas");
    } catch (error) {
      commit("SET_FORMULA_ERROR", error);
      notification.error({
        message: "Cập nhật công thức thất bại",
        description:
          error?.response?.data?.message ||
          error?.message ||
          "Không thể cập nhật công thức.",
      });
      throw error;
    } finally {
      commit("SET_FORMULA_LOADING", false);
    }
  },

  async deleteFormula({ dispatch, commit }, id) {
    commit("SET_FORMULA_LOADING", true);
    commit("SET_FORMULA_ERROR", null);
    try {
      await apiClient.delete(`/kpi-formulas/${id}`);
      notification.success({ message: "Xóa công thức thành công!" });
      await dispatch("fetchFormulas");
    } catch (error) {
      commit("SET_FORMULA_ERROR", error);
      notification.error({
        message: "Xóa công thức thất bại",
        description: error.message || "Không thể xóa công thức.",
      });
      throw error;
    } finally {
      commit("SET_FORMULA_LOADING", false);
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
