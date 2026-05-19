<script setup lang="ts">
/**
 * GM — Quản lý khung điểm đánh giá theo chu kỳ KPI (kpi_cycles).
 * Khóa/mở: status_code 201/202 — đồng bộ toàn hệ thống.
 */
import { ref, computed, watch } from "vue";
import { isAxiosError } from "axios";
import { gmKpiService } from "@/services/modules/kpi-gm.service";
import type {
  GmRatingScaleDetail,
  GmRatingScaleLevel,
  GmRatingScaleSummary,
  SaveGmRatingScaleLevelBody,
} from "@/types/gm-rating-scale";

const CYCLE_OPEN = 201;
const CYCLE_CLOSED = 202;

const summaries = ref<GmRatingScaleSummary[]>([]);
const detail = ref<GmRatingScaleDetail | null>(null);
const selectedYear = ref<number>(new Date().getFullYear());
const loadingList = ref(false);
const loadingDetail = ref(false);
const saving = ref(false);
const deletingId = ref<string | null>(null);

const showLevelDrawer = ref(false);
const levelDrawerMode = ref<"create" | "edit">("create");
const editingLevelId = ref<string | null>(null);

const statusSavingId = ref<string | null>(null);

const showDeleteModal = ref(false);
const deleteTarget = ref<GmRatingScaleLevel | null>(null);

const toastMsg = ref("");
const showToast = ref(false);

const formSortOrder = ref(0);
const formLevelCode = ref("");
const formLabel = ref("");
const formMinScore = ref("");
const formMaxScore = ref("");
const formPitch = ref("");
const formColorHex = ref("#3b82f6");
const formTopTier = ref(false);

const sortedSummaries = computed(() =>
  [...summaries.value].sort((a, b) => b.year - a.year),
);

const selectedSummary = computed(() =>
  summaries.value.find((s) => s.year === selectedYear.value),
);

const selectedEditable = computed(() => {
  if (detail.value != null) return detail.value.editable;
  return selectedSummary.value?.editable ?? false;
});

const hasScaleForSelectedYear = computed(
  () =>
    !!detail.value?.hasScale ||
    (detail.value?.levels?.length ?? 0) > 0 ||
    (selectedSummary.value?.levelCount ?? 0) > 0,
);

const hasAnyOpenCycle = computed(() =>
  summaries.value.some((s) => s.statusCode === CYCLE_OPEN),
);

const copySourceOptions = computed(() =>
  sortedSummaries.value.filter((s) => s.levelCount > 0),
);

const initCopySourceOptions = computed(() =>
  copySourceOptions.value.filter(
    (s) => s.cycleId !== selectedSummary.value?.cycleId,
  ),
);

const initCopyEnabled = ref(false);
const initCopyFromCycleId = ref<string | null>(null);

function showMessage(msg: string) {
  toastMsg.value = msg;
  showToast.value = true;
  globalThis.setTimeout(() => {
    showToast.value = false;
  }, 3200);
}

async function onCycleStatusToggle(s: GmRatingScaleSummary, ev: Event) {
  const input = ev.target as HTMLInputElement;
  const wantOpen = input.checked;
  const wasOpen = s.statusCode === CYCLE_OPEN;
  if (wantOpen === wasOpen) return;

  input.checked = wasOpen;
  statusSavingId.value = s.cycleId;
  try {
    const next = wantOpen ? CYCLE_OPEN : CYCLE_CLOSED;
    await gmKpiService.patchRatingScaleCycleStatus(s.cycleId, {
      statusCode: next,
    });
    showMessage(
      wantOpen
        ? `Đã mở kỳ đánh giá ${s.name}`
        : `Đã đóng kỳ đánh giá ${s.name}`,
    );
    await loadSummaries();
    await loadDetail(selectedYear.value);
  } catch (e) {
    showMessage(
      isAxiosError(e)
        ? String(e.response?.data?.message ?? e.message)
        : "Không thể đổi trạng thái chu kỳ.",
    );
  } finally {
    statusSavingId.value = null;
  }
}

async function loadSummaries() {
  loadingList.value = true;
  try {
    summaries.value = await gmKpiService.listRatingScales();
    if (summaries.value.length) {
      if (!summaries.value.some((s) => s.year === selectedYear.value)) {
        const open = summaries.value.find((s) => s.statusCode === CYCLE_OPEN);
        selectedYear.value = (open ?? summaries.value[0])!.year;
      }
    }
  } catch (e) {
    showMessage(
      isAxiosError(e)
        ? String(e.response?.data?.message ?? e.message)
        : "Không tải được danh sách năm.",
    );
  } finally {
    loadingList.value = false;
  }
}

async function loadDetail(year: number) {
  loadingDetail.value = true;
  try {
    detail.value = await gmKpiService.getRatingScaleByYear(year);
  } catch (e) {
    detail.value = null;
    showMessage(
      isAxiosError(e)
        ? String(e.response?.data?.message ?? e.message)
        : "Không tải được khung điểm.",
    );
  } finally {
    loadingDetail.value = false;
  }
}

watch(selectedYear, (y) => {
  if (Number.isFinite(y)) void loadDetail(y);
});

watch(selectedYear, () => {
  const cycleId = selectedSummary.value?.cycleId;
  if (!cycleId) return;
  const def =
    initCopySourceOptions.value.find(
      (s) => s.cycleId !== cycleId && s.levelCount > 0,
    )?.cycleId ?? null;
  initCopyEnabled.value = def != null;
  initCopyFromCycleId.value = def;
});

void loadSummaries().then(() => loadDetail(selectedYear.value));

function selectYear(year: number) {
  selectedYear.value = year;
}

function resetLevelForm() {
  const nextOrder = detail.value?.levels?.length ?? 0;
  formSortOrder.value = nextOrder;
  formLevelCode.value = "";
  formLabel.value = "";
  formMinScore.value = "";
  formMaxScore.value = "";
  formPitch.value = "0";
  formColorHex.value = "#3b82f6";
  formTopTier.value = false;
}

function openCreateLevel() {
  if (!selectedEditable.value || !detail.value?.cycleId) return;
  levelDrawerMode.value = "create";
  editingLevelId.value = null;
  resetLevelForm();
  showLevelDrawer.value = true;
}

function openEditLevel(lv: GmRatingScaleLevel) {
  if (!selectedEditable.value) return;
  levelDrawerMode.value = "edit";
  editingLevelId.value = lv.id;
  formSortOrder.value = lv.sortOrder;
  formLevelCode.value = lv.levelCode;
  formLabel.value = lv.label;
  formMinScore.value = String(lv.minScore);
  formMaxScore.value = lv.maxScore == null ? "" : String(lv.maxScore);
  formPitch.value = String(lv.pitch);
  formColorHex.value = lv.colorHex ?? "#64748b";
  formTopTier.value = !!lv.topTier;
  showLevelDrawer.value = true;
}

function closeLevelDrawer() {
  if (saving.value) return;
  showLevelDrawer.value = false;
}

function parseNum(raw: string): number | null {
  const n = Number.parseFloat(raw.trim());
  return Number.isFinite(n) ? n : null;
}

function buildLevelBody(): SaveGmRatingScaleLevelBody | null {
  const min = parseNum(formMinScore.value);
  const pitch = parseNum(formPitch.value);
  if (min == null || pitch == null) {
    showMessage("Vui lòng nhập điểm tối thiểu và pitch hợp lệ.");
    return null;
  }
  if (!formLevelCode.value.trim() || !formLabel.value.trim()) {
    showMessage("Vui lòng nhập mã mức và nhãn hiển thị.");
    return null;
  }
  const maxRaw = formMaxScore.value.trim();
  const max = maxRaw === "" ? null : parseNum(maxRaw);
  if (maxRaw !== "" && max == null) {
    showMessage("Điểm tối đa không hợp lệ.");
    return null;
  }
  return {
    sortOrder: formSortOrder.value,
    levelCode: formLevelCode.value.trim().toUpperCase(),
    label: formLabel.value.trim(),
    minScore: min,
    maxScore: max,
    pitch,
    colorHex: formColorHex.value.trim() || null,
    topTier: formTopTier.value,
  };
}

async function saveLevel() {
  const cycleId = detail.value?.cycleId ?? selectedSummary.value?.cycleId;
  if (!cycleId || !selectedEditable.value) return;
  const body = buildLevelBody();
  if (!body) return;

  saving.value = true;
  try {
    if (levelDrawerMode.value === "create") {
      await gmKpiService.addRatingScaleLevel(cycleId, body);
      showMessage("Đã thêm mức điểm.");
    } else if (editingLevelId.value) {
      await gmKpiService.updateRatingScaleLevel(
        cycleId,
        editingLevelId.value,
        body,
      );
      showMessage("Đã cập nhật mức điểm.");
    }
    showLevelDrawer.value = false;
    editingLevelId.value = null;
    await loadSummaries();
    await loadDetail(selectedYear.value);
  } catch (e) {
    showMessage(
      isAxiosError(e)
        ? String(e.response?.data?.message ?? e.message)
        : "Không lưu được mức điểm.",
    );
  } finally {
    saving.value = false;
  }
}

function openDeleteModal(lv: GmRatingScaleLevel) {
  if (!selectedEditable.value) return;
  deleteTarget.value = lv;
  showDeleteModal.value = true;
}

function closeDeleteModal() {
  if (deletingId.value) return;
  showDeleteModal.value = false;
  deleteTarget.value = null;
}

async function confirmDeleteLevel() {
  const cycleId = detail.value?.cycleId ?? selectedSummary.value?.cycleId;
  const lv = deleteTarget.value;
  if (!cycleId || !lv || !selectedEditable.value) return;

  deletingId.value = lv.id;
  try {
    await gmKpiService.deleteRatingScaleLevel(cycleId, lv.id);
    showMessage(`Đã xóa mức ${lv.levelCode}.`);
    showDeleteModal.value = false;
    deleteTarget.value = null;
    await loadSummaries();
    await loadDetail(selectedYear.value);
  } catch (e) {
    showMessage(
      isAxiosError(e)
        ? String(e.response?.data?.message ?? e.message)
        : "Không xóa được mức điểm.",
    );
  } finally {
    deletingId.value = null;
  }
}

async function initScaleForSelectedYear() {
  if (!selectedEditable.value) return;
  const cycleId = selectedSummary.value?.cycleId;
  if (!cycleId) return;
  if (
    initCopyEnabled.value &&
    (initCopyFromCycleId.value == null || !initCopySourceOptions.value.length)
  ) {
    showMessage("Vui lòng chọn năm nguồn để sao chép.");
    return;
  }
  saving.value = true;
  try {
    const body: {
      cycleId: string;
      name?: string;
      copyFromCycleId?: string;
    } = {
      cycleId,
      name: `Khung điểm ${selectedYear.value}`,
    };
    if (initCopyEnabled.value && initCopyFromCycleId.value) {
      body.copyFromCycleId = initCopyFromCycleId.value;
    }
    await gmKpiService.createRatingScale(body);
    const sourceYear = initCopySourceOptions.value.find(
      (s) => s.cycleId === initCopyFromCycleId.value,
    )?.year;
    const copied =
      initCopyEnabled.value && sourceYear != null
        ? ` (sao chép từ năm ${sourceYear})`
        : "";
    showMessage(`Đã tạo khung năm ${selectedYear.value}${copied}.`);
    await loadSummaries();
    await loadDetail(selectedYear.value);
  } catch (e) {
    showMessage(
      isAxiosError(e)
        ? String(e.response?.data?.message ?? e.message)
        : "Không tạo được khung.",
    );
  } finally {
    saving.value = false;
  }
}

function formatScore(v: number | string | null | undefined): string {
  if (v == null || v === "") return "—";
  return String(v);
}

function chipStyle(hex: string | null | undefined) {
  const c = hex?.trim() || "#64748b";
  return { backgroundColor: c, color: "#fff" };
}
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 p-4 sm:p-6">
    <div class="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <!-- Sidebar năm -->
      <aside
        class="w-full shrink-0 rounded-2xl border border-slate-200 bg-white shadow-sm lg:w-56"
      >
        <div class="border-b border-slate-100 px-4 py-3">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500">
            Năm đánh giá
          </h2>
        </div>
        <div v-if="loadingList" class="p-4 text-center text-sm text-slate-400">
          <i class="fas fa-spinner fa-spin" />
        </div>
        <ul v-else class="max-h-[min(24rem,50vh)] overflow-y-auto p-2">
          <li v-for="s in sortedSummaries" :key="s.cycleId">
            <div
              class="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors"
              :class="
                selectedYear === s.year
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100'
              "
            >
              <button
                type="button"
                class="min-w-0 flex-1 px-1 py-1 text-left text-sm"
                @click="selectYear(s.year)"
              >
                <span class="font-bold">{{ s.year }}</span>
                <span
                  class="mt-0.5 block text-[10px] font-semibold uppercase"
                  :class="
                    selectedYear === s.year
                      ? 'text-indigo-100'
                      : s.statusCode === CYCLE_OPEN
                        ? 'text-emerald-600'
                        : 'text-slate-400'
                  "
                >
                  {{ s.statusCode === CYCLE_OPEN ? "Đang mở" : "Đã đóng" }}
                </span>
              </button>
              <label
                class="relative inline-flex shrink-0 cursor-pointer items-center"
                :title="
                  s.statusCode === CYCLE_OPEN ? 'Đóng kỳ (202)' : 'Mở kỳ (201)'
                "
                @click.stop
              >
                <input
                  type="checkbox"
                  class="peer sr-only"
                  :checked="s.statusCode === CYCLE_OPEN"
                  :disabled="statusSavingId === s.cycleId"
                  @change="onCycleStatusToggle(s, $event)"
                />
                <span
                  class="h-5 w-9 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 peer-disabled:opacity-50"
                  :class="
                    selectedYear === s.year
                      ? 'bg-indigo-400 peer-checked:bg-emerald-400'
                      : ''
                  "
                />
                <span
                  class="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4"
                />
              </label>
            </div>
          </li>
        </ul>
        <p
          v-if="!loadingList && summaries.length && !hasAnyOpenCycle"
          class="border-t border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-800"
        >
          Không có năm nào đang mở. Bật toggle để mở kỳ trước khi chỉnh khung
          điểm.
        </p>
      </aside>

      <!-- Panel chi tiết -->
      <section
        class="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5"
        >
          <div>
            <h1 class="text-lg font-bold text-slate-900">
              {{ detail?.name ?? `Năm ${selectedYear}` }}
            </h1>
            <p class="mt-0.5 text-xs text-slate-500">
              {{ detail?.levels?.length ?? 0 }} mức
              <span
                v-if="!selectedEditable"
                class="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600"
              >
                <i class="fas fa-lock mr-1 text-[10px]" />
                Chỉ xem
              </span>
            </p>
          </div>
          <button
            v-if="selectedEditable && hasScaleForSelectedYear"
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            :disabled="loadingDetail"
            @click="openCreateLevel"
          >
            <i class="fas fa-plus text-xs" />
            Thêm mức
          </button>
        </div>

        <div
          v-if="loadingDetail"
          class="flex flex-1 items-center justify-center p-12"
        >
          <i class="fas fa-spinner fa-spin text-2xl text-indigo-400" />
        </div>

        <div
          v-else-if="!hasScaleForSelectedYear"
          class="flex flex-1 flex-col items-center justify-center gap-4 p-8 sm:p-12"
        >
          <p class="text-center text-sm text-slate-600">
            Chưa có khung điểm cho năm {{ selectedYear }}.
          </p>
          <div
            v-if="selectedEditable && initCopySourceOptions.length"
            class="w-full max-w-md rounded-xl border border-slate-200 bg-slate-50 p-4 text-left"
          >
            <label class="flex cursor-pointer items-start gap-3">
              <input
                v-model="initCopyEnabled"
                type="checkbox"
                class="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span class="text-sm text-slate-700">
                <span class="font-semibold text-slate-800"
                  >Sao chép mức điểm</span
                >
                từ năm khác khi khởi tạo
              </span>
            </label>
            <div v-if="initCopyEnabled" class="mt-3">
              <label class="mb-1 block text-xs font-bold text-slate-500"
                >Năm nguồn</label
              >
              <select
                v-model="initCopyFromCycleId"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option
                  v-for="s in initCopySourceOptions"
                  :key="s.cycleId"
                  :value="s.cycleId"
                >
                  {{ s.year }} — {{ s.levelCount }} mức
                </option>
              </select>
            </div>
          </div>
          <button
            v-if="selectedEditable"
            type="button"
            class="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
            :disabled="saving"
            @click="initScaleForSelectedYear"
          >
            Khởi tạo khung năm {{ selectedYear }}
          </button>
        </div>

        <div v-else class="min-h-0 flex-1 overflow-auto">
          <table class="w-full min-w-[720px] text-left text-sm">
            <thead
              class="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500"
            >
              <tr>
                <th class="px-4 py-3">#</th>
                <th class="px-4 py-3">Mã</th>
                <th class="px-4 py-3">Nhãn</th>
                <th class="px-4 py-3">Min</th>
                <th class="px-4 py-3">Max</th>
                <th class="px-4 py-3">Pitch %</th>
                <th class="px-4 py-3">Top</th>
                <th class="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="lv in detail?.levels ?? []"
                :key="lv.id"
                class="hover:bg-slate-50/80"
              >
                <td class="px-4 py-3 text-slate-500">{{ lv.sortOrder }}</td>
                <td class="px-4 py-3">
                  <span
                    class="inline-flex h-8 min-w-[2rem] items-center justify-center rounded px-2 text-xs font-bold shadow-sm"
                    :style="chipStyle(lv.colorHex)"
                  >
                    {{ lv.levelCode }}
                  </span>
                </td>
                <td class="px-4 py-3 font-medium text-slate-800">
                  {{ lv.label }}
                </td>
                <td class="px-4 py-3 font-mono text-slate-700">
                  {{ formatScore(lv.minScore) }}
                </td>
                <td class="px-4 py-3 font-mono text-slate-700">
                  {{ formatScore(lv.maxScore) }}
                </td>
                <td class="px-4 py-3 font-mono text-slate-700">
                  {{ formatScore(lv.pitch) }}
                </td>
                <td class="px-4 py-3">
                  <i
                    v-if="lv.topTier"
                    class="fas fa-star text-amber-500"
                    title="Nhóm xuất sắc"
                  />
                  <span v-else class="text-slate-300">—</span>
                </td>
                <td class="px-4 py-3 text-right">
                  <button
                    type="button"
                    class="mr-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-40"
                    :disabled="!selectedEditable"
                    title="Sửa"
                    @click="openEditLevel(lv)"
                  >
                    <i class="fas fa-pen text-xs" />
                  </button>
                  <button
                    type="button"
                    class="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                    :disabled="!selectedEditable || deletingId === lv.id"
                    title="Xóa"
                    @click="openDeleteModal(lv)"
                  >
                    <i
                      class="fas text-xs"
                      :class="
                        deletingId === lv.id
                          ? 'fa-spinner fa-spin'
                          : 'fa-trash-alt'
                      "
                    />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- Drawer: thêm/sửa mức -->
    <div
      v-if="showLevelDrawer"
      class="fixed inset-0 z-[80] flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        @click="closeLevelDrawer"
      />
      <div
        class="relative z-10 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"
        @click.stop
      >
        <div class="border-b border-slate-100 px-5 py-4">
          <h3 class="text-lg font-bold text-slate-900">
            {{
              levelDrawerMode === "create" ? "Thêm mức điểm" : "Sửa mức điểm"
            }}
          </h3>
          <p class="text-xs text-slate-500">Năm {{ selectedYear }}</p>
        </div>
        <div class="flex-1 space-y-4 overflow-y-auto p-5">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs font-bold text-slate-500"
                >Thứ tự</label
              >
              <input
                v-model.number="formSortOrder"
                type="number"
                min="0"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-bold text-slate-500"
                >Mã mức</label
              >
              <input
                v-model="formLevelCode"
                type="text"
                maxlength="10"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
                placeholder="A2"
              />
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs font-bold text-slate-500"
              >Nhãn hiển thị</label
            >
            <input
              v-model="formLabel"
              type="text"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="3.41-3.50 (A2)"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs font-bold text-slate-500"
                >Điểm min</label
              >
              <input
                v-model="formMinScore"
                type="text"
                inputmode="decimal"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-bold text-slate-500"
                >Điểm max</label
              >
              <input
                v-model="formMaxScore"
                type="text"
                inputmode="decimal"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                placeholder="Để trống = không giới hạn"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs font-bold text-slate-500"
                >Pitch (%)</label
              >
              <input
                v-model="formPitch"
                type="text"
                inputmode="decimal"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-bold text-slate-500"
                >Màu</label
              >
              <input
                v-model="formColorHex"
                type="color"
                class="h-10 w-full cursor-pointer rounded-lg border border-slate-300"
              />
            </div>
          </div>
          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input
              v-model="formTopTier"
              type="checkbox"
              class="rounded border-slate-300"
            />
            Thuộc nhóm xuất sắc (Top tier)
          </label>
        </div>
        <div class="flex justify-end gap-3 border-t border-slate-100 p-4">
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600"
            :disabled="saving"
            @click="closeLevelDrawer"
          >
            Hủy
          </button>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
            :disabled="saving"
            @click="saveLevel"
          >
            <i
              class="fas mr-1"
              :class="saving ? 'fa-spinner fa-spin' : 'fa-save'"
            />
            Lưu
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: xóa mức -->
    <div
      v-if="showDeleteModal && deleteTarget"
      class="fixed inset-0 z-[95] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div class="absolute inset-0 bg-slate-900/60" @click="closeDeleteModal" />
      <div
        class="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
        @click.stop
      >
        <h3 class="font-bold text-slate-900">
          Xóa mức {{ deleteTarget.levelCode }}?
        </h3>
        <p class="mt-2 text-sm text-slate-600">{{ deleteTarget.label }}</p>
        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm"
            :disabled="!!deletingId"
            @click="closeDeleteModal"
          >
            Hủy
          </button>
          <button
            type="button"
            class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white"
            :disabled="!!deletingId"
            @click="confirmDeleteLevel"
          >
            Xóa
          </button>
        </div>
      </div>
    </div>

    <div
      class="fixed top-5 right-5 z-[100] max-w-sm rounded-lg bg-slate-800 px-4 py-3 text-sm font-medium text-white shadow-lg transition-all"
      :class="
        showToast
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0 pointer-events-none'
      "
    >
      {{ toastMsg }}
    </div>
  </div>
</template>
