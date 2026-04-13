import dayjs from "dayjs";
import { getReviewCycles } from "@/core/services/kpiReviewApi";

const STORAGE_KEY = "kpi_selected_review_cycle_id";

function readStoredId() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export default {
  namespaced: true,
  state: {
    cycles: [],
    selectedCycleId: null,
    loaded: false,
    loading: false,
  },
  getters: {
    loaded: (state) => state.loaded,
    cycles: (state) => state.cycles,
    selectedCycleId: (state) => state.selectedCycleId,
    selectedCycle: (state) =>
      state.cycles.find((c) => c.id === state.selectedCycleId) || null,
    cycleSelectOptions: (state) =>
      state.cycles.map((c) => ({
        value: c.id,
        label: c.name,
      })),
    hasCycles: (state) => state.cycles.length > 0,
  },
  mutations: {
    SET_LOADING(state, v) {
      state.loading = v;
    },
    SET_CYCLES(state, cycles) {
      state.cycles = Array.isArray(cycles) ? cycles : [];
      state.loaded = true;
    },
    SET_SELECTED_CYCLE_ID(state, id) {
      state.selectedCycleId = id;
      if (id != null) {
        try {
          localStorage.setItem(STORAGE_KEY, String(id));
        } catch {
          /* ignore */
        }
      } else {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
      }
    },
    RESET(state) {
      state.cycles = [];
      state.selectedCycleId = null;
      state.loaded = false;
      state.loading = false;
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    },
  },
  actions: {
    async fetchCycles({ commit, dispatch }) {
      commit("SET_LOADING", true);
      try {
        const data = await getReviewCycles();
        const cycles = Array.isArray(data) ? data : data?.data ?? [];
        commit("SET_CYCLES", cycles);
        dispatch("ensureSelectedCycle");
      } catch {
        commit("SET_CYCLES", []);
        commit("SET_SELECTED_CYCLE_ID", null);
      } finally {
        commit("SET_LOADING", false);
      }
    },
    ensureSelectedCycle({ commit, state }) {
      const cycles = state.cycles;
      if (!cycles.length) {
        commit("SET_SELECTED_CYCLE_ID", null);
        return;
      }
      const storedId = readStoredId();
      if (storedId != null && cycles.some((c) => c.id === storedId)) {
        commit("SET_SELECTED_CYCLE_ID", storedId);
        return;
      }
      const today = dayjs().startOf("day");
      const current = cycles.find((cycle) => {
        const startDate = dayjs(cycle.startDate).startOf("day");
        const endDate = dayjs(cycle.endDate).startOf("day");
        return (
          (today.isAfter(startDate, "day") || today.isSame(startDate, "day")) &&
          (today.isBefore(endDate, "day") || today.isSame(endDate, "day"))
        );
      });
      if (current) {
        commit("SET_SELECTED_CYCLE_ID", current.id);
        return;
      }
      commit("SET_SELECTED_CYCLE_ID", cycles[0].id);
    },
    setSelectedCycleId({ commit, state }, id) {
      if (id == null) {
        commit("SET_SELECTED_CYCLE_ID", null);
        return;
      }
      if (state.cycles.some((c) => c.id === id)) {
        commit("SET_SELECTED_CYCLE_ID", id);
      }
    },
    clearOnLogout({ commit }) {
      commit("RESET");
    },
  },
};
