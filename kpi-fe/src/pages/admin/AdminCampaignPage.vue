<script setup lang="ts">
/**
 * AdminCampaignPage.vue
 * Trang Quản lý Chiến dịch Đánh giá KPI — chuyển đổi từ a1.html
 */
import { ref, computed } from "vue";
import { adminKpiService } from "@/services/modules/kpi-admin.service";
import type {
  Campaign,
  CampaignPeriod,
  EmployeeProgress,
} from "@/mocks/admin.mock";

type MailMode = "mass" | "single";

// ── State ──────────────────────────────────────────────────────────────────────

const campaigns = ref<Campaign[]>([]);
const employeeProgress = ref<EmployeeProgress[]>([]);
const selectedPeriod = ref<CampaignPeriod>("current");
const startDate = ref("");
const endDate = ref("");
const searchText = ref("");
const statusFilter = ref("all");
const selectedRows = ref<Set<string>>(new Set());
const showMassMailModal = ref(false);
const showRemindModal = ref(false);
const remindTarget = ref("");
const remindTargetId = ref("");
const remindTargetEmail = ref("");
const remindReason = ref("");
const mailMode = ref<MailMode>("mass");
const isSending = ref(false);
const toastMsg = ref("");
const showToast = ref(false);
const loading = ref(false);

// ── Init ───────────────────────────────────────────────────────────────────────

const init = async () => {
  loading.value = true;
  try {
    const [campaignRes, progressRes] = await Promise.all([
      adminKpiService.getCampaigns(),
      adminKpiService.getEmployeeProgress(selectedPeriod.value),
    ]);
    campaigns.value = campaignRes;
    employeeProgress.value = progressRes;
  } finally {
    loading.value = false;
  }
};
init();

// ── Computed ───────────────────────────────────────────────────────────────────

const currentCampaign = computed(() =>
  campaigns.value.find((c) => c.period === selectedPeriod.value),
);

const isPast = computed(() => selectedPeriod.value.startsWith("past"));
const isActive = computed(() => !isPast.value);

const currentStats = computed(
  () =>
    currentCampaign.value?.stats ?? {
      total: 0,
      completed: 0,
      pending: 0,
      notStarted: 0,
      overdue: 0,
    },
);

const filteredProgress = computed(() => {
  let rows = employeeProgress.value;
  if (searchText.value) {
    const q = searchText.value.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
    );
  }
  if (statusFilter.value !== "all") {
    rows = rows.filter((r) => r.status === statusFilter.value);
  }
  return rows;
});

const checkedCount = computed(() => selectedRows.value.size);

const selectableRows = computed(() =>
  filteredProgress.value
    .filter((r) => r.status !== "completed")
    .map((r) => r.id),
);

// ── Methods ────────────────────────────────────────────────────────────────────

const handlePeriodChange = async () => {
  selectedRows.value.clear();
  loading.value = true;
  try {
    employeeProgress.value = await adminKpiService.getEmployeeProgress(
      selectedPeriod.value,
    );
  } finally {
    loading.value = false;
  }
};

const toggleAll = (checked: boolean) => {
  if (checked) {
    selectableRows.value.forEach((id) => selectedRows.value.add(id));
  } else {
    selectedRows.value.clear();
  }
};

const toggleRow = (id: string, completed: boolean) => {
  if (completed) return;
  if (selectedRows.value.has(id)) {
    selectedRows.value.delete(id);
  } else {
    selectedRows.value.add(id);
  }
};

const openMassMailModal = () => {
  if (!startDate.value || !endDate.value) {
    alert("Vui lòng chọn Từ ngày và Đến ngày trước khi gửi thông báo.");
    return;
  }
  mailMode.value = "mass";
  showMassMailModal.value = true;
};

/** Mở modal remind cho một nhân viên cụ thể */
const openSingleRemindModal = (row: EmployeeProgress) => {
  mailMode.value = "single";
  remindTarget.value = row.name;
  remindTargetId.value = row.id;
  remindTargetEmail.value = row.email;
  remindReason.value = statusBadge(row.status).label;
  showRemindModal.value = true;
};

const closeModals = () => {
  showMassMailModal.value = false;
  showRemindModal.value = false;
};

/** Thực thi gửi email — phân biệt mass mail vs single remind */
const executeSendMail = async (customMsg: string) => {
  if (isSending.value) return;
  isSending.value = true;
  closeModals();

  try {
    const campaignId = currentCampaign.value?.id ?? "";

    if (mailMode.value === "single") {
      await adminKpiService.sendRemind(campaignId, remindTargetId.value, customMsg);
      triggerToast(`Đã gửi email nhắc nhở đến ${remindTarget.value} thành công!`);
    } else {
      await adminKpiService.sendMassMail(campaignId, customMsg);
      triggerToast("Đã gửi thông báo đánh giá KPI đến toàn bộ nhân viên thành công!");
    }

    selectedRows.value.clear();
  } finally {
    isSending.value = false;
  }
};

const triggerToast = (msg: string) => {
  toastMsg.value = msg;
  showToast.value = true;
  setTimeout(() => {
    showToast.value = false;
  }, 3000);
};

// ── Status Helpers ─────────────────────────────────────────────────────────────

const statusBadge = (status: string) =>
  ({
    overdue: {
      cls: "text-red-600 bg-red-50 border border-red-200",
      icon: "fa-exclamation-circle",
      label: "Quá hạn",
      pulse: true,
    },
    not_started: {
      cls: "text-slate-600 bg-slate-100 border border-slate-200",
      icon: "fa-circle",
      label: "Chưa đánh giá",
      pulse: false,
    },
    pending: {
      cls: "text-blue-600 bg-blue-50 border border-blue-200",
      icon: "fa-clock",
      label: "Chờ PM Duyệt",
      pulse: false,
    },
    completed: {
      cls: "text-green-700 bg-green-100 border border-green-300",
      icon: "fa-check-circle",
      label: "Hoàn tất",
      pulse: false,
    },
  })[status] ?? { cls: "", icon: "", label: status, pulse: false };

const remindBtnCls = (status: string) =>
  ({
    overdue: "text-red-600 bg-white border border-red-200 hover:bg-red-50",
    not_started:
      "text-orange-600 bg-white border border-orange-200 hover:bg-orange-50",
    pending: "text-blue-600 bg-white border border-blue-200 hover:bg-blue-50",
  })[status];

const remindBtnLabel = (status: string) =>
  ({
    overdue: "Remind",
    not_started: "Remind",
    pending: "Remind",
  })[status] ?? "";
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- HEADER -->
    <header
      class="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shrink-0"
    >
      <div>
        <h1 class="text-2xl font-bold text-slate-800">
          Quản lý Chiến dịch Đánh giá KPI
        </h1>
        <p class="text-sm text-slate-500 mt-1">
          Điều phối thời gian và nhắc nhở tiến độ toàn công ty
        </p>
      </div>

      <!-- Period Selector -->
      <div class="relative">
        <select
          v-model="selectedPeriod"
          class="appearance-none bg-indigo-50 text-indigo-700 pl-10 pr-10 py-2 rounded-md text-sm font-bold border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:bg-indigo-100 transition-colors shadow-sm"
          @change="handlePeriodChange"
        >
          <option v-for="c in campaigns" :key="c.period" :value="c.period">
            {{ c.label }}
          </option>
        </select>
        <i
          class="fas fa-calendar text-indigo-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-sm"
        />
        <i
          class="fas fa-chevron-down text-indigo-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-sm"
        />
      </div>
    </header>

    <main class="flex-1 overflow-auto p-8 bg-slate-50/50">
      <div class="max-w-[1400px] mx-auto space-y-6">
        <!-- CAMPAIGN CONTROL PANEL -->
        <div
          class="bg-white rounded-xl p-6 shadow-sm relative overflow-hidden transition-all duration-300 border"
          :class="isPast ? 'border-slate-200 bg-slate-50' : 'border-indigo-100'"
        >
          <div
            class="absolute top-0 left-0 w-1 h-full"
            :class="isPast ? 'bg-slate-300' : 'bg-indigo-500'"
          />

          <!-- Active Campaign Controls -->
          <div v-if="isActive">
            <div class="flex justify-between items-start mb-5">
              <div>
                <h2
                  class="text-lg font-bold text-slate-800 flex items-center mb-1"
                >
                  <i class="fas fa-paper-plane w-5 h-5 mr-2 text-indigo-600" />
                  Phát hành Thông báo Đánh giá KPI
                </h2>
                <p class="text-sm text-slate-500">
                  Thiết lập thời gian và gửi Email hàng loạt yêu cầu toàn bộ
                  nhân viên thực hiện đánh giá.
                </p>
              </div>
            </div>

            <div
              class="flex items-end space-x-6 bg-slate-50 p-4 rounded-lg border border-slate-200"
            >
              <div class="flex-1">
                <label
                  class="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider"
                >
                  Từ ngày (Start Date) <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="startDate"
                  type="date"
                  class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                />
              </div>
              <div class="flex-1">
                <label
                  class="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider"
                >
                  Đến ngày (Deadline) <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="endDate"
                  type="date"
                  class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                />
              </div>
              <div class="w-64">
                <button
                  class="w-full bg-indigo-600 text-white text-sm font-bold px-5 py-2.5 rounded-md hover:bg-indigo-700 shadow-sm transition-colors flex items-center justify-center"
                  @click="openMassMailModal"
                >
                  <i class="fas fa-envelope mr-2" /> Gửi Mail Toàn công ty
                </button>
              </div>
            </div>
          </div>

          <!-- Archived Campaign -->
          <div v-else class="flex items-center space-x-4">
            <div
              class="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center"
            >
              <i class="fas fa-archive text-slate-500 text-lg" />
            </div>
            <div>
              <h2 class="text-lg font-bold text-slate-700">
                Chiến dịch Đánh giá đã đóng băng
              </h2>
              <p class="text-sm text-slate-500 mt-1">
                Dữ liệu của năm đánh giá này đã được lưu trữ (Archived) thành
                công. Không thể thiết lập thời gian hay gửi mail thông báo cho
                kỳ này nữa.
              </p>
            </div>
          </div>
        </div>

        <!-- PROGRESS SUMMARY STATS -->
        <div class="grid grid-cols-5 gap-4">
          <div
            class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"
          >
            <div
              class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1"
            >
              Tổng Nhân sự
            </div>
            <div class="text-2xl font-black text-slate-800">
              {{ currentStats.total }}
            </div>
          </div>
          <div
            class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-green-500"
          >
            <div
              class="text-xs font-bold text-green-600 uppercase tracking-wider mb-1"
            >
              Đã Hoàn tất
            </div>
            <div class="text-2xl font-black text-slate-700">
              {{ currentStats.completed }}
            </div>
          </div>
          <div
            class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-blue-500"
          >
            <div
              class="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1"
            >
              Chờ PM Duyệt
            </div>
            <div class="text-2xl font-black text-slate-700">
              {{ currentStats.pending }}
            </div>
          </div>
          <div
            class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-slate-400"
          >
            <div
              class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1"
            >
              Chưa đánh giá
            </div>
            <div class="text-2xl font-black text-slate-700">
              {{ currentStats.notStarted }}
            </div>
          </div>
          <div
            class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-red-500 relative overflow-hidden"
          >
            <div
              class="absolute -right-2 -top-2 w-12 h-12 bg-red-50 rounded-full flex items-center justify-center"
            >
              <i class="fas fa-exclamation-circle text-red-200" />
            </div>
            <div
              class="text-xs font-bold text-red-600 uppercase tracking-wider mb-1 relative z-10"
            >
              Quá hạn nộp
            </div>
            <div class="text-2xl font-black text-red-600 relative z-10">
              {{ currentStats.overdue }}
            </div>
          </div>
        </div>

        <!-- EMPLOYEE PROGRESS TABLE -->
        <div
          class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
        >
          <!-- Toolbar -->
          <div
            class="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center"
          >
            <div class="flex items-center space-x-3">
              <h2
                class="font-bold text-slate-800 text-sm uppercase tracking-wider"
              >
                Danh sách Tiến độ Nhân sự
              </h2>
              <span
                class="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded"
              >
                {{ currentStats.total }} Records
              </span>
            </div>

            <div
              class="flex items-center space-x-3 transition-all"
              :class="isPast ? 'opacity-50 pointer-events-none' : ''"
            >
              <!-- Search -->
              <div class="relative">
                <i
                  class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"
                />
                <input
                  v-model="searchText"
                  type="text"
                  placeholder="Tìm NV, Email..."
                  class="pl-9 pr-4 py-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-indigo-500 w-56 bg-white"
                />
              </div>

              <!-- Status Filter -->
              <select
                v-model="statusFilter"
                class="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white font-medium text-slate-600 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">Lọc: Tất cả Trạng thái</option>
                <option value="overdue">Quá hạn nộp</option>
                <option value="not_started">Chưa đánh giá</option>
                <option value="pending">Chờ PM Duyệt</option>
              </select>
            </div>
          </div>

          <table class="w-full text-left border-collapse">
            <thead>
              <tr
                class="bg-white border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider"
              >
                <th class="p-4 w-[25%]">Nhân viên / Email</th>
                <th class="p-4 w-[20%]">Phòng ban (Section)</th>
                <th class="p-4 w-[20%] text-center">Trạng thái (Status)</th>
                <th class="p-4 text-center">Cập nhật cuối</th>
                <th v-if="isActive" class="p-4 text-center w-32">Thao tác</th>
              </tr>
            </thead>

            <!-- Skeleton loading -->
            <tbody v-if="loading" class="divide-y divide-slate-100">
              <tr v-for="i in 4" :key="i" class="animate-pulse">
                <td class="p-4">
                  <div class="h-4 bg-slate-200 rounded w-40" />
                </td>
                <td class="p-4">
                  <div class="h-4 bg-slate-200 rounded w-28" />
                </td>
                <td class="p-4 text-center">
                  <div class="h-6 bg-slate-200 rounded-full w-24 mx-auto" />
                </td>
                <td class="p-4">
                  <div class="h-4 bg-slate-200 rounded w-20 mx-auto" />
                </td>
                <td v-if="isActive" class="p-4" />
              </tr>
            </tbody>

            <!-- Active period rows -->
            <tbody v-else-if="isActive" class="divide-y divide-slate-100">
              <tr
                v-for="row in filteredProgress"
                :key="row.id"
                class="hover:bg-slate-50 transition-colors group"
                :class="row.status === 'overdue' ? 'bg-red-50/10' : ''"
              >
                <td
                  class="p-4"
                  :class="row.status === 'completed' ? 'opacity-75' : ''"
                >
                  <div class="flex items-center">
                    <div
                      class="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mr-3 shrink-0"
                    >
                      <i class="fas fa-user text-slate-400 text-sm" />
                    </div>
                    <div>
                      <div class="font-bold text-slate-800 text-sm">
                        {{ row.name }}
                      </div>
                      <div class="text-[10px] text-slate-500">
                        {{ row.email }}
                      </div>
                    </div>
                  </div>
                </td>
                <td
                  class="p-4"
                  :class="row.status === 'completed' ? 'opacity-75' : ''"
                >
                  <div class="text-sm font-semibold text-slate-700">
                    {{ row.section }}
                  </div>
                  <div
                    class="text-[10px] text-slate-400 uppercase tracking-wider"
                  >
                    {{ row.division }}
                  </div>
                </td>
                <td class="p-4 text-center">
                  <span
                    class="inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-full uppercase"
                    :class="[
                      statusBadge(row.status).cls,
                      statusBadge(row.status).pulse ? 'animate-pulse' : '',
                    ]"
                  >
                    <i
                      :class="`fas ${statusBadge(row.status).icon} w-3 mr-1 text-xs`"
                    />
                    {{ statusBadge(row.status).label }}
                  </span>
                </td>
                <td
                  class="p-4 text-center text-xs text-slate-500"
                  :class="!row.lastUpdate ? 'italic' : ''"
                >
                  {{ row.lastUpdate ?? "Chưa đăng nhập" }}
                </td>
                <td class="p-4 text-center">
                  <button
                    v-if="row.status !== 'completed'"
                    class="text-xs font-bold px-3 py-1.5 rounded shadow-sm w-full transition-colors flex items-center justify-center"
                    :class="remindBtnCls(row.status)"
                    @click="openSingleRemindModal(row)"
                  >
                    <i class="fas fa-bell-ring mr-1.5 text-xs" />
                    {{ remindBtnLabel(row.status) }}
                  </button>
                  <button
                    v-else
                    disabled
                    class="text-xs font-bold text-slate-400 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded w-full cursor-not-allowed"
                  >
                    Đã nộp
                  </button>
                </td>
              </tr>
            </tbody>

            <!-- Past period rows (archived) -->
            <tbody v-else class="divide-y divide-slate-100">
              <tr
                v-for="row in filteredProgress"
                :key="row.id"
                class="hover:bg-slate-50 transition-colors"
              >
                <td class="p-4 opacity-75">
                  <div class="flex items-center">
                    <div>
                      <div class="font-bold text-slate-800 text-sm">
                        {{ row.name }}
                      </div>
                      <div class="text-[10px] text-slate-500">
                        {{ row.email }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="p-4 opacity-75">
                  <div class="text-sm font-semibold text-slate-700">
                    {{ row.section }}
                  </div>
                  <div
                    class="text-[10px] text-slate-400 uppercase tracking-wider"
                  >
                    {{ row.division }}
                  </div>
                </td>
                <td class="p-4 text-center">
                  <span
                    class="inline-flex items-center text-[10px] font-bold text-green-700 bg-green-100 border border-green-300 px-2.5 py-1 rounded-full uppercase"
                  >
                    <i class="fas fa-check-circle w-3 mr-1 text-xs" /> Đã đóng
                    KPI (Lưu trữ)
                  </span>
                </td>
                <td class="p-4 text-center text-xs text-slate-500 font-medium">
                  {{ row.lastUpdate }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>

  <!-- ── MODAL: MASS EMAIL ANNOUNCEMENT ──────────────────────────────────────── -->
  <Transition name="modal">
    <div
      v-if="showMassMailModal"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        @click="closeModals"
      />
      <div
        class="bg-white rounded-xl shadow-2xl w-full max-w-2xl z-10 overflow-hidden flex flex-col"
      >
        <div
          class="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-indigo-600 text-white"
        >
          <h3 class="font-bold text-lg flex items-center">
            <i class="fas fa-bullhorn mr-2" /> Xác nhận gửi Thông báo Đánh giá
          </h3>
          <button class="text-indigo-200 hover:text-white" @click="closeModals">
            <i class="fas fa-times" />
          </button>
        </div>
        <div class="p-6 bg-slate-50 flex-1">
          <div class="mb-4">
            <span
              class="text-xs font-bold text-slate-500 uppercase tracking-wider"
              >Người nhận:</span
            >
            <div
              class="mt-1 font-semibold text-slate-800 bg-white p-2 rounded border border-slate-200 flex items-center"
            >
              <i class="fas fa-users mr-2 text-indigo-500" /> Tất cả nhân viên
              ({{ currentStats.total }} người)
            </div>
          </div>
          <div>
            <span
              class="text-xs font-bold text-slate-500 uppercase tracking-wider"
              >Nội dung Email (Preview):</span
            >
            <div
              class="mt-1 bg-white p-4 rounded border border-slate-200 text-sm text-slate-700 leading-relaxed shadow-inner"
            >
              <p class="font-bold mb-2">
                Subject: [Thông báo] Yêu cầu thực hiện Đánh giá KPI ({{
                  currentCampaign?.label
                }})
              </p>
              <hr class="mb-2" />
              <p>Kính gửi toàn thể Cán bộ Nhân viên,</p>
              <p class="mt-2">
                Hệ thống Đánh giá KPI cho kỳ hiện tại đã chính thức được mở.
              </p>
              <p class="mt-2">Thời gian tự đánh giá:</p>
              <ul
                class="list-disc list-inside ml-4 mt-1 font-semibold text-indigo-700"
              >
                <li>Bắt đầu: {{ startDate }}</li>
                <li>Hạn chót: {{ endDate }}</li>
              </ul>
              <p class="mt-2">
                Vui lòng đăng nhập vào hệ thống và hoàn thành trước hạn chót.
              </p>
              <p class="mt-4 italic text-slate-500">
                Trân trọng,<br />HR &amp; Admin Team
              </p>
            </div>
          </div>
        </div>
        <div
          class="px-6 py-4 border-t border-slate-200 bg-white flex justify-end space-x-3"
        >
          <button
            class="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            @click="closeModals"
          >
            Hủy
          </button>
          <button
            class="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm flex items-center disabled:opacity-60 disabled:cursor-not-allowed"
            :disabled="isSending"
            @click="executeSendMail('')"
          >
            <i v-if="isSending" class="fas fa-spinner fa-spin mr-2" />
            <i v-else class="fas fa-paper-plane mr-2" />
            {{ isSending ? "Đang gửi..." : "Xác nhận Gửi" }}
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- ── MODAL: REMIND ──────────────────────────────────────────────────────── -->
  <Transition name="modal">
    <div
      v-if="showRemindModal"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        @click="closeModals"
      />
      <div
        class="bg-white rounded-xl shadow-2xl w-full max-w-xl z-10 overflow-hidden flex flex-col border-t-4 border-t-orange-500"
      >
        <div
          class="px-6 py-4 border-b border-slate-200 flex justify-between items-center"
        >
          <h3 class="font-bold text-lg text-slate-800 flex items-center">
            <i class="fas fa-bell mr-2 text-orange-500" /> Gửi Email Nhắc nhở
            (Remind)
          </h3>
          <button
            class="text-slate-400 hover:text-slate-600"
            @click="closeModals"
          >
            <i class="fas fa-times" />
          </button>
        </div>
        <div class="p-6 space-y-4">
          <!-- Người nhận -->
          <div>
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Người nhận
            </p>
            <div class="bg-white border border-slate-200 rounded-md px-3 py-2 flex items-center space-x-2">
              <i class="fas fa-user text-orange-500 text-sm" />
              <span class="font-semibold text-slate-800 text-sm">{{ remindTarget }}</span>
              <span class="text-slate-400 text-xs">·</span>
              <span class="text-indigo-600 text-xs font-mono">{{ remindTargetEmail }}</span>
            </div>
          </div>
          <!-- Nội dung preview -->
          <div>
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Nội dung Email (Preview)
            </p>
            <div
              class="bg-orange-50 border border-orange-100 p-4 rounded text-sm text-slate-700 italic leading-relaxed"
            >
              "Kính gửi <strong class="text-slate-800 not-italic">{{ remindTarget }}</strong>,
              hệ thống ghi nhận bạn đang ở trạng thái
              <strong class="text-red-600 not-italic">{{ remindReason }}</strong>
              trong kỳ đánh giá KPI <strong class="text-slate-800 not-italic">{{ currentCampaign?.label ?? 'hiện tại' }}</strong>.
              Vui lòng đăng nhập vào hệ thống và hoàn thành ngay lập tức."
            </div>
          </div>
        </div>
        <div
          class="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end space-x-3"
        >
          <button
            class="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            @click="closeModals"
          >
            Hủy
          </button>
          <button
            class="px-4 py-2 text-sm font-bold text-white bg-orange-500 rounded-md hover:bg-orange-600 shadow-sm flex items-center disabled:opacity-60 disabled:cursor-not-allowed"
            :disabled="isSending"
            @click="executeSendMail('')"
          >
            <i v-if="isSending" class="fas fa-spinner fa-spin mr-2" />
            <i v-else class="fas fa-paper-plane mr-2" />
            {{ isSending ? "Đang gửi..." : "Gửi Remind" }}
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- ── TOAST ─────────────────────────────────────────────────────────────── -->
  <Transition name="toast">
    <div
      v-if="showToast"
      class="fixed top-5 right-5 bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center z-50"
    >
      <i class="fas fa-check-circle mr-3 text-green-400" />
      <span class="text-sm font-medium">{{ toastMsg }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.toast-enter-active,
.toast-leave-active {
  transition: transform 0.3s;
}
.toast-enter-from,
.toast-leave-to {
  transform: translateX(120%);
}
</style>
