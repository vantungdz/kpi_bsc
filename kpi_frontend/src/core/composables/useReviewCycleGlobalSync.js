import { watch, unref } from "vue";

function listIncludesCycleId(list, gid) {
  if (gid == null || gid === "") return true;
  return list.some((c) => Number(c.id) === Number(gid));
}

/**
 * @param {import("vuex").Store} store
 * @param {unknown[]} cycles — cycle list with at least `id` on each item
 */
export function pickReviewCycleIdFromStore(store, cycles) {
  const list = Array.isArray(cycles) ? cycles : [];
  const gid = store.getters["reviewCycle/selectedCycleId"];
  if (gid == null || gid === "") return null;
  return listIncludesCycleId(list, gid) ? Number(gid) : null;
}

/**
 * When the header review cycle (Vuex) changes, update the local filter and call `apply`.
 * @returns {() => void} stop handle for the watcher
 */
export function syncLocalReviewCycleFromStore(store, opts) {
  const {
    cyclesRef,
    getLocalCycleId,
    setLocalCycleId,
    apply,
    compareAsString = false,
  } = opts;

  function same(a, b) {
    if (compareAsString) return String(a ?? "") === String(b ?? "");
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return Number(a) === Number(b);
  }

  return watch(
    () => store.getters["reviewCycle/selectedCycleId"],
    (gid) => {
      const cycles = unref(cyclesRef);
      if (!Array.isArray(cycles) || cycles.length === 0) return;
      if (!listIncludesCycleId(cycles, gid)) return;
      const cur = getLocalCycleId();
      if (same(cur, gid)) return;
      const next =
        gid == null || gid === ""
          ? compareAsString
            ? ""
            : null
          : compareAsString
            ? String(gid)
            : Number(gid);
      setLocalCycleId(next);
      apply?.();
    },
  );
}

export function pushReviewCycleToGlobalStore(store, id) {
  store.dispatch("reviewCycle/setSelectedCycleId", id ?? null);
}
