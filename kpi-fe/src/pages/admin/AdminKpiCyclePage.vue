<script setup lang="ts">
/**
 * AdminKpiCyclePage.vue
 * Quản lý kỳ đánh giá — chuyển từ layout/admin/a4.html, dữ liệu kpi_cycles.
 */
import { ref, computed, watch } from "vue";
import { isAxiosError } from "axios";
import {
  adminKpiService,
  type CreateAdminKpiCycleBody,
  type KpiCyclePhaseKey,
} from "@/services/modules/kpi-admin.service";
import type { AdminKpiCycle } from "@/mocks/admin.mock";

const cycles = ref<AdminKpiCycle[]>([]);
const loading = ref(false);
const submitting = ref(false);
const showDrawer = ref(false);
const expanded = ref<Record<number, boolean>>({});

const toastMsg = ref("");
const showToast = ref(false);

const formYear = ref<number>(new Date().getFullYear() + 1);
const formName = ref("");
const goalSettingStart = ref("");
const goalSettingEnd = ref("");
const midYearStart = ref("");
const midYearEnd = ref("");
const endYearStart = ref("");
const endYearEnd = ref("");
const activateImmediately = ref(false);

const statusSavingId = ref<string | null>(null);

const hasOpenCycle = computed(() =>
  cycles.value.some((c) => c.statusCode === 201),
);

function showMessage(msg: string) {
  toastMsg.value = msg;
  showToast.value = true;
  globalThis.setTimeout(() => {
    showToast.value = false;
  }, 3200);
}

async function onCycleStatusToggle(c: AdminKpiCycle, ev: Event) {
  const input = ev.target as HTMLInputElement;
  const wantOpen = input.checked;
  const wasOpen = c.statusCode === 201;
  if (wantOpen === wasOpen) return;

  input.checked = wasOpen;
  statusSavingId.value = c.id;
  try {
    const next = wantOpen ? 201 : 202;
    await adminKpiService.patchKpiCycleStatus(c.id, next);
    showMessage(
      wantOpen
        ? `Đã mở kỳ đánh giá ${c.name}`
        : `Đã đóng kỳ đánh giá ${c.name}`,
    );
    await load();
  } catch (e) {
    showMessage(
      isAxiosError(e)
        ? String(e.response?.data?.message ?? e.message)
        : "Không thể mở cùng lúc 2 kỳ đánh giá",
    );
  } finally {
    statusSavingId.value = null;
  }
}

function formatViDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(d);
}

function formatRange(a: string, b: string): string {
  return `${formatViDate(a)} - ${formatViDate(b)}`;
}

/** Chuỗi yyyy-MM-dd cho &lt;input type="date"&gt; (múi giờ VN). */
function isoToDateInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

const editPhaseOpen = ref(false);
const editSaving = ref(false);
const editCycle = ref<AdminKpiCycle | null>(null);
const editPhaseKey = ref<KpiCyclePhaseKey>("goal_setting");
const editPeriodTitle = ref("");
const editStartDate = ref("");
const editEndDate = ref("");

function openEditPhase(c: AdminKpiCycle, phase: KpiCyclePhaseKey) {
  if (c.statusCode !== 201) return;
  editCycle.value = c;
  editPhaseKey.value = phase;
  editPeriodTitle.value =
    phase === "goal_setting"
      ? "Giai đoạn Thiết lập Mục tiêu"
      : phase === "mid_year"
        ? "Đánh giá 1st Half (1H)"
        : "Đánh giá 2nd Half (2H)";
  const startIso =
    phase === "goal_setting"
      ? c.goalSettingStart
      : phase === "mid_year"
        ? c.midYearStart
        : c.endYearStart;
  const endIso =
    phase === "goal_setting"
      ? c.goalSettingEnd
      : phase === "mid_year"
        ? c.midYearEnd
        : c.endYearEnd;
  editStartDate.value = isoToDateInput(startIso);
  editEndDate.value = isoToDateInput(endIso);
  editPhaseOpen.value = true;
}

function closeEditPhase() {
  editPhaseOpen.value = false;
  editCycle.value = null;
}

async function saveEditPhase() {
  if (!editCycle.value) return;
  if (!editStartDate.value || !editEndDate.value) {
    showMessage("Vui lòng chọn đầy đủ Ngày bắt đầu và Ngày kết thúc.");
    return;
  }
  if (new Date(editStartDate.value) > new Date(editEndDate.value)) {
    showMessage("Ngày bắt đầu không được lớn hơn Ngày kết thúc.");
    return;
  }
  editSaving.value = true;
  try {
    await adminKpiService.updateKpiCyclePhaseDates(editCycle.value.id, {
      phase: editPhaseKey.value,
      startDate: editStartDate.value,
      endDate: editEndDate.value,
    });
    showMessage("Đã cập nhật lịch trình thành công.");
    closeEditPhase();
    await load();
  } catch (e) {
    showMessage(
      isAxiosError(e)
        ? String(e.response?.data?.message ?? e.message)
        : "Không lưu được lịch trình.",
    );
  } finally {
    editSaving.value = false;
  }
}

const usedYears = computed(() => new Set(cycles.value.map((c) => c.year)));

const yearOptions = computed(() => {
  const y0 = new Date().getFullYear();
  const maxExisting =
    cycles.value.length > 0 ? Math.max(...cycles.value.map((c) => c.year)) : y0;
  const from = Math.max(y0, maxExisting);
  const out: number[] = [];
  for (let y = from; y <= from + 10; y++) {
    if (!usedYears.value.has(y)) out.push(y);
    if (out.length >= 8) break;
  }
  if (!out.length) out.push(maxExisting + 1);
  return out;
});

const activeCycle = computed(() => {
  const opens = cycles.value.filter((c) => c.statusCode === 201);
  if (!opens.length) return null;
  return [...opens].sort((a, b) => b.year - a.year)[0];
});

async function load() {
  loading.value = true;
  try {
    cycles.value = await adminKpiService.getKpiCycles();
    const ex: Record<number, boolean> = {};
    for (const c of cycles.value) ex[c.year] = true;
    expanded.value = ex;
  } catch (e) {
    showMessage(
      isAxiosError(e)
        ? String(e.response?.data?.message ?? e.message)
        : "Không tải được danh sách kỳ đánh giá.",
    );
  } finally {
    loading.value = false;
  }
}

void load();

function toggleYear(year: number) {
  expanded.value = { ...expanded.value, [year]: !expanded.value[year] };
}

function openDrawer() {
  showDrawer.value = true;
}

function closeDrawer() {
  showDrawer.value = false;
}

function resetFormDefaults() {
  const y = yearOptions.value[0] ?? new Date().getFullYear() + 1;
  formYear.value = y;
  formName.value = `Năm ${y}`;
  goalSettingStart.value = `${y}-01-01`;
  goalSettingEnd.value = `${y}-01-31`;
  midYearStart.value = `${y}-06-01`;
  midYearEnd.value = `${y}-06-15`;
  endYearStart.value = `${y}-12-01`;
  endYearEnd.value = `${y}-12-20`;
  activateImmediately.value = false;
}

watch(showDrawer, (open) => {
  if (open) {
    resetFormDefaults();
    if (hasOpenCycle.value) {
      activateImmediately.value = false;
    }
  }
});

watch(formYear, (y) => {
  if (showDrawer.value && formName.value.match(/^Năm \d{4}$/)) {
    formName.value = `Năm ${y}`;
  }
});

function validateForm(): string | null {
  const dates = [
    goalSettingStart,
    goalSettingEnd,
    midYearStart,
    midYearEnd,
    endYearStart,
    endYearEnd,
  ];
  for (const r of dates) {
    if (!r.value) return "Vui lòng nhập đủ các mốc ngày.";
  }
  if (!formName.value.trim()) return "Vui lòng nhập tên hiển thị.";
  return null;
}

async function submitCreate() {
  const err = validateForm();
  if (err) {
    showMessage(err);
    return;
  }
  if (
    activateImmediately.value &&
    cycles.value.some((x) => x.statusCode === 201)
  ) {
    showMessage(
      "Đang có một năm đánh giá đang mở (201). Không thể kích hoạt năm mới ngay lập tức. Vui lòng đóng kỳ hiện tại trước, hoặc bỏ chọn “Kích hoạt ngay”.",
    );
    return;
  }
  submitting.value = true;
  const body: CreateAdminKpiCycleBody = {
    year: formYear.value,
    name: formName.value.trim(),
    goalSettingStartDate: goalSettingStart.value,
    goalSettingEndDate: goalSettingEnd.value,
    midYearStartDate: midYearStart.value,
    midYearEndDate: midYearEnd.value,
    endYearStartDate: endYearStart.value,
    endYearEndDate: endYearEnd.value,
    activateImmediately: activateImmediately.value,
  };
  try {
    await adminKpiService.createKpiCycle(body);
    showMessage("Đã khởi tạo năm đánh giá mới.");
    closeDrawer();
    await load();
  } catch (e) {
    showMessage(
      isAxiosError(e)
        ? String(e.response?.data?.message ?? e.message)
        : "Không lưu được. Vui lòng thử lại.",
    );
  } finally {
    submitting.value = false;
  }
}

function phaseBadge(c: AdminKpiCycle) {
  if (c.statusCode === 201)
    return {
      label: "Đang hoạt động",
      cls: "bg-green-100 text-green-700 border-green-200",
    };
  return {
    label: "Đã đóng",
    cls: "bg-slate-100 text-slate-600 border-slate-200",
  };
}
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <header
      class="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shrink-0"
    >
      <div>
        <h1 class="text-2xl font-bold text-slate-800">
          Cấu hình Năm Đánh giá KPI
        </h1>
        <p class="text-sm text-slate-500 mt-1">
          Quản lý vòng đời của các năm đánh giá. Chỉ một năm được
          <span class="font-semibold text-slate-600">mở</span> tại một thời điểm
          — dùng nút đóng/mở trên từng năm hoặc tùy chọn khi khởi tạo. Mở năm
          khác khi đã có năm đang mở sẽ bị từ chối.
        </p>
      </div>
      <button
        type="button"
        class="bg-indigo-600 text-white border border-indigo-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-2 transition-colors"
        @click="openDrawer"
      >
        <i class="fas fa-calendar-plus text-sm" />
        Khởi tạo Năm Mới
      </button>
    </header>

    <main class="flex-1 overflow-auto p-8 bg-slate-50/50">
      <div class="max-w-[1400px] mx-auto space-y-6">
        <div v-if="loading" class="text-center text-slate-500 text-sm py-12">
          <i class="fas fa-spinner fa-spin mr-2" />
          Đang tải…
        </div>

        <template v-else>
          <!-- Active highlight -->
          <div
            class="rounded-2xl shadow-lg border p-6 relative overflow-hidden flex flex-col text-white transition-all duration-300"
            :class="
              activeCycle
                ? 'bg-indigo-600 border-indigo-700'
                : 'bg-slate-600 border-slate-700'
            "
          >
            <div
              class="absolute -right-10 -bottom-10 opacity-20 pointer-events-none"
            >
              <i class="fas fa-bolt text-[10rem]" />
            </div>
            <div class="relative z-10 flex items-center gap-5">
              <div
                class="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-inner shrink-0"
                :class="activeCycle ? 'text-indigo-600' : 'text-slate-600'"
              >
                <i
                  class="fas fa-broadcast-tower text-xl"
                  :class="activeCycle ? 'animate-pulse' : ''"
                />
              </div>
              <div>
                <div
                  class="text-xs font-bold uppercase tracking-wider mb-1 opacity-90"
                >
                  Trạng thái hệ thống
                </div>
                <h2 class="text-2xl font-black mb-1">
                  <template v-if="activeCycle">
                    Kỳ đánh giá NĂM {{ activeCycle.year }} đang được MỞ
                  </template>
                  <template v-else> Chưa có kỳ nào đang MỞ </template>
                </h2>
                <p class="text-sm opacity-90">
                  <template v-if="activeCycle">
                    {{ activeCycle.name }} — các giai đoạn Thiết lập mục tiêu,
                    1H, 2H hiển thị theo lịch đã cấu hình.
                  </template>
                  <template v-else>
                    Tạo năm mới hoặc kích hoạt một kỳ để hệ thống có chu kỳ
                    OPEN.
                  </template>
                </p>
              </div>
            </div>
          </div>

          <!-- Year list -->
          <div
            v-for="c in cycles"
            :key="c.id"
            class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4"
          >
            <div
              class="w-full px-5 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center gap-3 hover:bg-slate-100 transition-colors"
            >
              <button
                type="button"
                class="flex-1 min-w-0 flex items-center flex-wrap gap-2 text-left"
                @click="toggleYear(c.year)"
              >
                <h3
                  class="font-black text-lg text-slate-800 flex items-center flex-wrap gap-2"
                >
                  <i
                    class="fas text-indigo-500 shrink-0"
                    :class="
                      expanded[c.year] !== false
                        ? 'fa-folder-open'
                        : 'fa-folder'
                    "
                  />
                  NĂM {{ c.year }}
                  <span
                    class="text-[10px] px-2 py-0.5 rounded font-bold uppercase border"
                    :class="phaseBadge(c).cls"
                  >
                    {{ phaseBadge(c).label }}
                  </span>
                </h3>
              </button>
              <div class="flex items-center gap-4 shrink-0" @click.stop>
                <span
                  class="text-sm font-bold whitespace-nowrap hidden sm:inline"
                  :class="
                    c.statusCode === 201 ? 'text-indigo-600' : 'text-slate-500'
                  "
                >
                  {{ c.statusCode === 201 ? "Đang Mở" : "Đã Đóng" }}
                </span>
                <label
                  class="relative inline-flex items-center cursor-pointer"
                  :class="
                    statusSavingId === c.id
                      ? 'opacity-50 pointer-events-none'
                      : ''
                  "
                >
                  <input
                    type="checkbox"
                    class="sr-only peer"
                    :checked="c.statusCode === 201"
                    :aria-label="`Mở hoặc đóng kỳ ${c.year}`"
                    @change="onCycleStatusToggle(c, $event)"
                  />
                  <div
                    class="relative w-11 h-6 bg-slate-200 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"
                  />
                </label>
                <button
                  type="button"
                  class="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/80"
                  :aria-expanded="expanded[c.year] !== false"
                  @click="toggleYear(c.year)"
                >
                  <i
                    class="fas transition-transform text-sm"
                    :class="
                      expanded[c.year] !== false
                        ? 'fa-chevron-up'
                        : 'fa-chevron-down'
                    "
                  />
                </button>
              </div>
            </div>

            <div
              v-show="expanded[c.year] !== false"
              class="divide-y divide-slate-100"
            >
              <div
                class="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/80 bg-white"
              >
                <div class="flex items-start gap-3 sm:w-2/5">
                  <div
                    class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200 shadow-sm shrink-0"
                  >
                    <i class="fas fa-bullseye text-sm" />
                  </div>
                  <div>
                    <div class="font-bold text-slate-800">
                      Giai đoạn Thiết lập Mục tiêu
                    </div>
                  </div>
                </div>
                <div class="sm:w-2/5 text-center">
                  <span
                    class="bg-slate-50 border border-slate-200 text-slate-600 text-xs px-3 py-1.5 rounded font-medium shadow-sm inline-flex items-center gap-1.5"
                  >
                    <i class="far fa-calendar-alt text-slate-400" />
                    {{ formatRange(c.goalSettingStart, c.goalSettingEnd) }}
                  </span>
                </div>
                <div class="sm:w-1/5 flex justify-end">
                  <button
                    type="button"
                    :disabled="c.statusCode !== 201"
                    :title="
                      c.statusCode !== 201
                        ? 'Kỳ đã đóng (202). Chỉ kỳ đang mở (201) mới chỉnh sửa lịch.'
                        : undefined
                    "
                    class="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded shadow-sm transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-50 disabled:hover:text-indigo-600"
                    @click="openEditPhase(c, 'goal_setting')"
                  >
                    <i class="far fa-calendar-check text-xs" />
                    Sửa thời gian
                  </button>
                </div>
              </div>

              <div
                class="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/80 bg-white"
              >
                <div class="flex items-start gap-3 sm:w-2/5">
                  <div
                    class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200 shadow-sm shrink-0"
                  >
                    <i class="fas fa-chart-bar text-sm" />
                  </div>
                  <div>
                    <div class="font-bold text-slate-800">
                      Đánh giá 1st Half (1H)
                    </div>
                  </div>
                </div>
                <div class="sm:w-2/5 text-center">
                  <span
                    class="bg-slate-50 border border-slate-200 text-slate-600 text-xs px-3 py-1.5 rounded font-medium shadow-sm inline-flex items-center gap-1.5"
                  >
                    <i class="far fa-calendar-alt text-slate-400" />
                    {{ formatRange(c.midYearStart, c.midYearEnd) }}
                  </span>
                </div>
                <div class="sm:w-1/5 flex justify-end">
                  <button
                    type="button"
                    :disabled="c.statusCode !== 201"
                    :title="
                      c.statusCode !== 201
                        ? 'Kỳ đã đóng (202). Chỉ kỳ đang mở (201) mới chỉnh sửa lịch.'
                        : undefined
                    "
                    class="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded shadow-sm transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-50 disabled:hover:text-indigo-600"
                    @click="openEditPhase(c, 'mid_year')"
                  >
                    <i class="far fa-calendar-check text-xs" />
                    Sửa thời gian
                  </button>
                </div>
              </div>

              <div
                class="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/80 bg-white"
              >
                <div class="flex items-start gap-3 sm:w-2/5">
                  <div
                    class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200 shadow-sm shrink-0"
                  >
                    <i class="fas fa-chart-area text-sm" />
                  </div>
                  <div>
                    <div class="font-bold text-slate-800">
                      Đánh giá 2nd Half (2H)
                    </div>
                  </div>
                </div>
                <div class="sm:w-2/5 text-center">
                  <span
                    class="bg-slate-50 border border-slate-200 text-slate-600 text-xs px-3 py-1.5 rounded font-medium shadow-sm inline-flex items-center gap-1.5"
                  >
                    <i class="far fa-calendar-alt text-slate-400" />
                    {{ formatRange(c.endYearStart, c.endYearEnd) }}
                  </span>
                </div>
                <div class="sm:w-1/5 flex justify-end">
                  <button
                    type="button"
                    :disabled="c.statusCode !== 201"
                    :title="
                      c.statusCode !== 201
                        ? 'Kỳ đã đóng (202). Chỉ kỳ đang mở (201) mới chỉnh sửa lịch.'
                        : undefined
                    "
                    class="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded shadow-sm transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-50 disabled:hover:text-indigo-600"
                    @click="openEditPhase(c, 'end_year')"
                  >
                    <i class="far fa-calendar-check text-xs" />
                    Sửa thời gian
                  </button>
                </div>
              </div>
            </div>
          </div>

          <p
            v-if="!cycles.length"
            class="text-center text-slate-500 text-sm py-6"
          >
            Chưa có dữ liệu kỳ đánh giá.
          </p>
        </template>
      </div>
    </main>

    <!-- Modal: Cài đặt thời gian (a4.html) -->
    <div
      v-if="editPhaseOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-phase-title"
    >
      <div
        class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        @click="closeEditPhase"
      />
      <div
        class="relative bg-white rounded-xl shadow-2xl w-full max-w-md z-10 overflow-hidden flex flex-col border-t-4 border-t-indigo-500"
        @click.stop
      >
        <div
          class="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50"
        >
          <h3
            id="edit-phase-title"
            class="font-bold text-lg text-slate-800 flex items-center gap-2"
          >
            <i class="fas fa-calendar-alt text-indigo-600" />
            Cài đặt Thời gian
          </h3>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200"
            aria-label="Đóng"
            @click="closeEditPhase"
          >
            <i class="fas fa-times" />
          </button>
        </div>
        <div class="p-6">
          <p class="text-sm text-slate-600 mb-4">
            Điều chỉnh lịch trình hoạt động cho:
            <strong class="text-slate-800 block mt-1 text-base">{{
              editPeriodTitle
            }}</strong>
          </p>
          <div class="space-y-4">
            <div>
              <label
                class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5"
              >
                Ngày Bắt đầu <span class="text-red-500">*</span>
              </label>
              <input
                v-model="editStartDate"
                type="date"
                class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
              />
            </div>
            <div>
              <label
                class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5"
              >
                Ngày Kết thúc (Hạn chót) <span class="text-red-500">*</span>
              </label>
              <input
                v-model="editEndDate"
                type="date"
                class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
              />
            </div>
          </div>
        </div>
        <div
          class="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3"
        >
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            :disabled="editSaving"
            @click="closeEditPhase"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            class="px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm inline-flex items-center gap-2 disabled:opacity-60"
            :disabled="editSaving"
            @click="saveEditPhase"
          >
            <i
              class="fas text-sm"
              :class="editSaving ? 'fa-spinner fa-spin' : 'fa-save'"
            />
            Lưu Lịch trình
          </button>
        </div>
      </div>
    </div>

    <!-- Drawer -->
    <div
      class="fixed inset-0 z-40 flex justify-end transition-all duration-300"
      :class="showDrawer ? 'pointer-events-auto' : 'pointer-events-none'"
    >
      <div
        class="absolute inset-0 bg-slate-900/40 transition-opacity duration-300"
        :class="showDrawer ? 'opacity-100' : 'opacity-0'"
        @click="closeDrawer"
      />
      <div
        class="relative w-full max-w-lg h-full bg-slate-50 shadow-2xl flex flex-col transform transition-transform duration-300 border-l border-slate-200"
        :class="showDrawer ? 'translate-x-0' : 'translate-x-full'"
      >
        <div
          class="px-6 py-4 border-b border-slate-200 bg-white flex justify-between items-center shrink-0"
        >
          <div>
            <h2 class="text-lg font-bold text-slate-800">
              Khởi tạo Năm Đánh giá Mới
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">
              Mặc định năm mới là
              <span class="font-semibold">đóng (202)</span>; chỉ thành
              <span class="font-semibold">mở (201)</span> khi chọn “Kích hoạt
              ngay” và hiện không có năm nào đang mở.
            </p>
          </div>
          <button
            type="button"
            class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full"
            aria-label="Đóng"
            @click="closeDrawer"
          >
            <i class="fas fa-times" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <div
            class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"
          >
            <div class="flex flex-col sm:flex-row gap-4">
              <div class="sm:w-1/3">
                <label
                  class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2"
                >
                  Chọn năm <span class="text-red-500">*</span>
                </label>
                <select
                  v-model.number="formYear"
                  class="w-full border border-slate-300 rounded-lg px-3 py-2 text-lg font-black text-indigo-700 focus:ring-2 focus:ring-indigo-500 bg-indigo-50/30"
                >
                  <option v-for="y in yearOptions" :key="y" :value="y">
                    {{ y }}
                  </option>
                </select>
              </div>
              <div class="sm:flex-1">
                <label
                  class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2"
                >
                  Tên hiển thị
                </label>
                <input
                  v-model="formName"
                  type="text"
                  class="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                  placeholder="Ví dụ: Năm 2027"
                />
              </div>
            </div>
          </div>

          <div>
            <h3
              class="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2"
            >
              <i class="far fa-calendar text-slate-500" />
              Thiết lập lịch trình
            </h3>
            <div class="space-y-4">
              <div
                class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"
              >
                <h4 class="font-bold text-slate-800 text-sm mb-1">
                  Giai đoạn 1: Thiết lập Mục tiêu
                </h4>
                <p class="text-[11px] text-slate-500 mb-3">
                  Ngày bắt đầu / kết thúc (goal_setting_*)
                </p>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      class="block text-[10px] font-bold text-slate-400 uppercase mb-1"
                      >Bắt đầu</label
                    >
                    <input
                      v-model="goalSettingStart"
                      type="date"
                      class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label
                      class="block text-[10px] font-bold text-slate-400 uppercase mb-1"
                      >Kết thúc</label
                    >
                    <input
                      v-model="goalSettingEnd"
                      type="date"
                      class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div
                class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"
              >
                <h4 class="font-bold text-slate-800 text-sm mb-1">
                  Giai đoạn 2: Đánh giá 1H
                </h4>
                <p class="text-[11px] text-slate-500 mb-3">
                  mid_year_start / mid_year_end
                </p>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      class="block text-[10px] font-bold text-slate-400 uppercase mb-1"
                      >Bắt đầu</label
                    >
                    <input
                      v-model="midYearStart"
                      type="date"
                      class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label
                      class="block text-[10px] font-bold text-slate-400 uppercase mb-1"
                      >Kết thúc</label
                    >
                    <input
                      v-model="midYearEnd"
                      type="date"
                      class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div
                class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"
              >
                <h4 class="font-bold text-slate-800 text-sm mb-1">
                  Giai đoạn 3: Đánh giá 2H
                </h4>
                <p class="text-[11px] text-slate-500 mb-3">
                  end_year_start / end_year_end
                </p>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      class="block text-[10px] font-bold text-slate-400 uppercase mb-1"
                      >Bắt đầu</label
                    >
                    <input
                      v-model="endYearStart"
                      type="date"
                      class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label
                      class="block text-[10px] font-bold text-slate-400 uppercase mb-1"
                      >Kết thúc</label
                    >
                    <input
                      v-model="endYearEnd"
                      type="date"
                      class="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            class="bg-slate-100 p-5 rounded-xl border border-slate-200"
            :class="hasOpenCycle ? 'opacity-75' : ''"
          >
            <label
              class="flex items-start gap-3"
              :class="hasOpenCycle ? 'cursor-not-allowed' : 'cursor-pointer'"
            >
              <input
                v-model="activateImmediately"
                type="checkbox"
                class="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-0.5 shrink-0 disabled:opacity-50"
                :disabled="hasOpenCycle"
              />
              <div>
                <div class="font-bold text-slate-700 text-sm">
                  Kích hoạt (MỞ) năm đánh giá này ngay lập tức
                </div>
                <div class="text-xs text-slate-500 mt-1 leading-relaxed">
                  Gán <span class="font-mono">status_code = 201</span> cho năm
                  mới. Chỉ khả dụng khi chưa có năm nào đang mở (201); nếu đang
                  có, hãy đóng kỳ hiện tại bằng công tắc hoặc bỏ chọn mục này.
                </div>
              </div>
            </label>
          </div>
        </div>

        <div
          class="p-4 border-t border-slate-200 bg-white shrink-0 flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
        >
          <button
            type="button"
            class="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            :disabled="submitting"
            @click="closeDrawer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            class="px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-md flex items-center gap-2 disabled:opacity-60"
            :disabled="submitting"
            @click="submitCreate"
          >
            <i
              class="fas text-sm"
              :class="submitting ? 'fa-spinner fa-spin' : 'fa-check-circle'"
            />
            Hoàn tất khởi tạo
          </button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div
      class="fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-all duration-300 bg-slate-800 text-white text-sm font-medium max-w-sm"
      :class="
        showToast
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0 pointer-events-none'
      "
    >
      <i class="fas fa-info-circle text-indigo-300 shrink-0" />
      <span>{{ toastMsg }}</span>
    </div>
  </div>
</template>
