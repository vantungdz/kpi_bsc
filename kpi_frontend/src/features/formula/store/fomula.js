import apiClient from "@/core/services/api";
import { notification } from "ant-design-vue";
import { getTranslatedErrorMessage } from "@/core/services/messageTranslator";
import i18n from "@/core/i18n";

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
      ? getTranslatedErrorMessage(error.response?.data?.message) ||
        error.message ||
        i18n.global.t("errors.unknownError")
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

      // Only show notification if it's not a permission error (already handled by API interceptor)
      const errorMsg =
        getTranslatedErrorMessage(error.response?.data?.message) ||
        error.message ||
        i18n.global.t("errors.unknownError");
      if (!error.response?.data?.message?.includes("No permission")) {
        notification.error({
          message: i18n.global.t("errors.unknownError"),
          description: errorMsg,
          duration: 5,
        });
      }

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
      notification.success({ message: "Formula added successfully!" });
      await dispatch("fetchFormulas");
    } catch (error) {
      commit("SET_FORMULA_ERROR", error);
      const errorMsg =
        getTranslatedErrorMessage(error?.response?.data?.message) ||
        error?.message ||
        i18n.global.t("errors.unknownError");
      notification.error({
        message: i18n.global.t("errors.unknownError"),
        description: errorMsg,
        duration: 5,
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
      notification.success({ message: "Formula updated successfully!" });
      await dispatch("fetchFormulas");
    } catch (error) {
      commit("SET_FORMULA_ERROR", error);
      const errorMsg =
        getTranslatedErrorMessage(error?.response?.data?.message) ||
        error?.message ||
        i18n.global.t("errors.unknownError");
      notification.error({
        message: i18n.global.t("errors.unknownError"),
        description: errorMsg,
        duration: 5,
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
      notification.success({ message: "Formula deleted successfully!" });
      await dispatch("fetchFormulas");
    } catch (error) {
      commit("SET_FORMULA_ERROR", error);
      const errorMsg =
        getTranslatedErrorMessage(error?.response?.data?.message) ||
        error?.message ||
        i18n.global.t("errors.unknownError");
      notification.error({
        message: i18n.global.t("errors.unknownError"),
        description: errorMsg,
        duration: 5,
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
