import { watch } from "vue";
import dayjs from "dayjs";

/**
 * Stable string for the selected review cycle id plus normalized start/end dates.
 * Used as the watch source so prefill runs when the header cycle changes or when
 * cycles finish loading (selectedCycle resolves from null to an object).
 */
function reviewCycleDatesSignature(store) {
  const c = store.getters["reviewCycle/selectedCycle"];
  if (!c) return "";
  const start = c.startDate ?? c.start_date;
  const end = c.endDate ?? c.end_date;
  if (start == null || end == null) return String(c.id ?? "");
  return `${c.id}|${dayjs(start).format("YYYY-MM-DD")}|${dayjs(end).format("YYYY-MM-DD")}`;
}

/**
 * Re-run `prefill` when the header review cycle (Vuex) changes or cycle data becomes available.
 * @param {import("vuex").Store} store
 * @param {() => void} prefill
 */
export function watchReviewCycleAndPrefillDates(store, prefill) {
  watch(
    () => reviewCycleDatesSignature(store),
    () => {
      prefill();
    },
  );
}
